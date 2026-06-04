import axios from 'axios';

export function startPredictionScheduler(pool) {
  const enabled = (process.env.ENABLE_PREDICTION_SCHEDULER || 'false') === 'true';
  if (!enabled) {
    console.log('Prediction scheduler disabled (ENABLE_PREDICTION_SCHEDULER != true)');
    return null;
  }

  const intervalMin = Number(process.env.PREDICTION_SCHEDULE_INTERVAL_MIN || 60);
  const mlBaseUrl = process.env.ML_API_URL || 'http://localhost:5001';

  const runOnce = async () => {
    try {
      console.log('Prediction scheduler: collecting recent sales...');
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
        console.log('Prediction scheduler: no recent sales data — skipping');
        return;
      }

      const salesPayload = salesRows.map((row) => ({
        medicine_name: row.medicine_name,
        amount: Number(row.amount) || 0,
        quantity: row.quantity,
      }));

      const mlResponse = await axios.post(`${mlBaseUrl}/predict`, salesPayload);
      if (!mlResponse.data || !mlResponse.data.success || !mlResponse.data.data) {
        console.warn('Prediction scheduler: ML module returned invalid response');
        return;
      }

      const prediction = mlResponse.data.data;
      const [result] = await pool.query(
        `INSERT INTO disease_outbreak_predictions (predicted_disease, confidence_score, risk_level, predicted_region)
         VALUES (?, ?, ?, ?)`,
        [prediction.predicted_disease, prediction.confidence_score, prediction.risk_level || 'medium', prediction.predicted_region || null]
      );

      const predictionId = result.insertId;
      console.log('Prediction scheduler: saved prediction', predictionId);

      // Try to insert medicine recommendations if ML returns them
      try {
        const recResponse = await axios.post(`${mlBaseUrl}/recommend-medicines`, { disease: prediction.predicted_disease });
        if (recResponse.data && recResponse.data.success && recResponse.data.data) {
          const recommendations = recResponse.data.data.recommended_medicines || [];
          for (const rec of recommendations) {
            const [medRows] = await pool.query('SELECT medicine_id FROM medicines WHERE name LIKE ? LIMIT 1', [`%${rec.name}%`]);
            if (medRows && medRows.length > 0) {
              const medicineId = medRows[0].medicine_id;
              await pool.query(
                `INSERT INTO medicine_recommendations (prediction_id, medicine_id, recommendation_reason, priority)
                 VALUES (?, ?, ?, ?)`,
                [predictionId, medicineId, rec.reason || 'Recommended by ML model', rec.priority || 'medium']
              );
            }
          }
        }
      } catch (recErr) {
        console.warn('Prediction scheduler: failed to save recommendations', recErr.message);
      }
    } catch (err) {
      console.warn('Prediction scheduler error', err.message);
    }
  };

  // Run immediately, then schedule
  runOnce();
  const intervalMs = Math.max(1000 * 60, intervalMin * 60 * 1000);
  const id = setInterval(runOnce, intervalMs);
  console.log(`Prediction scheduler started (every ${intervalMin} minutes)`);
  return id;
}

export default startPredictionScheduler;
