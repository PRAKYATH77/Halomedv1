import express from 'express';
import axios from 'axios';
import { sendResponse, handleError } from '../utils/helpers.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get predictions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { risk_level } = req.query;

    let query = 'SELECT * FROM disease_outbreak_predictions WHERE 1=1';
    const params = [];

    if (risk_level) {
      query += ' AND risk_level = ?';
      params.push(risk_level);
    }

    query += ' ORDER BY prediction_date DESC LIMIT 100';

    const [predictions] = await pool.query(query, params);
    sendResponse(res, 200, true, 'Predictions retrieved successfully', predictions);
  } catch (error) {
    handleError(error, res);
  }
});

// Get medicine recommendations for any disease (directly from ML service)
router.get('/medicines/:disease', authenticateToken, async (req, res) => {
  try {
    const { disease } = req.params;
    const mlBaseUrl = process.env.ML_API_URL || 'http://localhost:5001';

    // Call ML service to get recommendations
    const mlResponse = await axios.post(`${mlBaseUrl}/recommend-medicines`, {
      disease: disease,
    });

    if (!mlResponse.data || !mlResponse.data.success || !mlResponse.data.data) {
      return sendResponse(res, 500, false, 'ML service error', {
        status: 'error',
      });
    }

    const mlData = mlResponse.data.data;
    const pool = req.app.locals.pool;

    // Enrich with actual medicine data from database
    const enrichedRecommendations = [];
    for (const rec of mlData.recommended_medicines || []) {
      const [medRows] = await pool.query(
        'SELECT medicine_id, name, price, stock_quantity FROM medicines WHERE name LIKE ? LIMIT 1',
        [`%${rec.name}%`]
      );

      enrichedRecommendations.push({
        ...rec,
        medicine_id: medRows && medRows.length > 0 ? medRows[0].medicine_id : null,
        db_price: medRows && medRows.length > 0 ? medRows[0].price : null,
        current_stock: medRows && medRows.length > 0 ? medRows[0].stock_quantity : null,
      });
    }

    sendResponse(res, 200, true, 'Recommendations retrieved successfully', {
      disease: mlData.disease,
      recommended_medicines: enrichedRecommendations,
      expected_demand_increase: mlData.expected_demand_increase,
      expected_duration: mlData.expected_duration,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Get recommendations for a specific prediction
router.get('/recommendations/:predictionId', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { predictionId } = req.params;

    const [recommendations] = await pool.query(`
      SELECT mr.*, m.name as medicine_name, m.price
      FROM medicine_recommendations mr
      JOIN medicines m ON mr.medicine_id = m.medicine_id
      WHERE mr.prediction_id = ?
      ORDER BY mr.priority DESC
    `, [predictionId]);

    sendResponse(res, 200, true, 'Recommendations retrieved successfully', recommendations);
  } catch (error) {
    handleError(error, res);
  }
});

// Trigger ML prediction using real sales data and Flask ML module
router.post('/trigger', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // 1. Load recent sales data to send to the ML service
    const [salesRows] = await pool.query(
      `SELECT 
         m.name AS medicine_name,
         sd.subtotal AS amount,
         sd.quantity
       FROM sale_details sd
       JOIN sales s ON sd.sale_id = s.sale_id
       JOIN medicines m ON sd.medicine_id = m.medicine_id
       ORDER BY s.sale_date DESC
       LIMIT 200`
    );

    if (!salesRows || salesRows.length === 0) {
      return sendResponse(res, 200, true, 'Not enough sales data to generate prediction', {
        status: 'no-data',
        message: 'Add some sales/orders first, then trigger predictions again.',
      });
    }

    const salesPayload = salesRows.map((row) => ({
      medicine_name: row.medicine_name,
      amount: Number(row.amount) || 0,
      quantity: row.quantity,
    }));

    const mlBaseUrl = process.env.ML_API_URL || 'http://localhost:5001';

    // 2. Call the Flask ML module to get a prediction
    const mlResponse = await axios.post(`${mlBaseUrl}/predict`, salesPayload);

    if (!mlResponse.data || !mlResponse.data.success || !mlResponse.data.data) {
      return sendResponse(res, 500, false, 'ML module did not return a valid prediction', {
        status: 'error',
        message: 'Check ML module logs and configuration.',
      });
    }

    const prediction = mlResponse.data.data;

    // 3. Persist prediction in the database
    const [result] = await pool.query(
      `INSERT INTO disease_outbreak_predictions 
       (predicted_disease, confidence_score, risk_level, predicted_region)
       VALUES (?, ?, ?, ?)`,
      [
        prediction.predicted_disease,
        prediction.confidence_score,
        prediction.risk_level || 'medium',
        prediction.predicted_region || null,
      ]
    );

    const predictionId = result.insertId;

    // 4. Optionally fetch medicine-level recommendations from ML module
    try {
      const recResponse = await axios.post(`${mlBaseUrl}/recommend-medicines`, {
        disease: prediction.predicted_disease,
      });

      if (recResponse.data && recResponse.data.success && recResponse.data.data) {
        const recommendations = recResponse.data.data.recommended_medicines || [];

        for (const rec of recommendations) {
          // Try to match recommendation to an existing medicine by name
          const [medRows] = await pool.query(
            'SELECT medicine_id FROM medicines WHERE name LIKE ? LIMIT 1',
            [`%${rec.name}%`]
          );

          if (medRows && medRows.length > 0) {
            const medicineId = medRows[0].medicine_id;

            await pool.query(
              `INSERT INTO medicine_recommendations 
               (prediction_id, medicine_id, recommendation_reason, priority)
               VALUES (?, ?, ?, ?)`,
              [
                predictionId,
                medicineId,
                rec.reason || 'Recommended by ML model',
                rec.priority || 'medium',
              ]
            );
          }
        }
      }
    } catch (recError) {
      // Recommendation generation failures should not break the main prediction flow
      console.error('Failed to generate medicine recommendations from ML module:', recError.message);
    }

    // 5. Return the saved prediction
    sendResponse(res, 200, true, 'Prediction triggered successfully', {
      status: 'completed',
      prediction_id: predictionId,
      prediction,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Create prediction (admin only)
router.post('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { predicted_disease, confidence_score, risk_level, predicted_region } = req.body;

    const [result] = await pool.query(
      `INSERT INTO disease_outbreak_predictions 
       (predicted_disease, confidence_score, risk_level, predicted_region)
       VALUES (?, ?, ?, ?)`,
      [predicted_disease, confidence_score, risk_level || 'medium', predicted_region || null]
    );

    sendResponse(res, 201, true, 'Prediction created successfully', {
      prediction_id: result.insertId,
    });
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
