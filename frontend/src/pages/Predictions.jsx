import React, { useEffect, useState } from 'react';
import { predictionsAPI } from '../services/api';
import { Brain } from 'lucide-react';

function Predictions() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    try {
      setError('');
      const response = await predictionsAPI.getAll({});
      setPredictions(response.data);
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerPrediction = async () => {
    try {
      setTriggering(true);
      setError('');
      await predictionsAPI.trigger();
      await fetchPredictions();
    } catch (error) {
      console.error('Failed to trigger prediction:', error);
      setError('Failed to trigger ML prediction. Please ensure the ML service is running.');
    } finally {
      setTriggering(false);
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Disease Outbreak Predictions</h1>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading predictions...</div>
      ) : predictions.length === 0 ? (
        <div className="card text-center py-12">
          <Brain className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-gray-600 mb-4">No predictions yet. ML model is analyzing data based on your sales and stock.</p>
          <button
            className="btn-primary btn-sm"
            onClick={handleTriggerPrediction}
            disabled={triggering}
          >
            {triggering ? 'Running prediction...' : 'Run Prediction from Current Stock'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {predictions.map((prediction) => (
            <div key={prediction.prediction_id} className={`card border-l-4 border-l-${prediction.risk_level === 'high' ? 'red' : prediction.risk_level === 'medium' ? 'yellow' : 'green'}-500`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    {prediction.predicted_disease}
                  </h3>
                  <p className="text-sm text-gray-600">Predicted Region: {prediction.predicted_region || 'Nationwide'}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getRiskColor(prediction.risk_level)}`}>
                  {prediction.risk_level} Risk
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-gray-600 text-sm">Confidence Score</p>
                  <p className="text-lg font-semibold text-primary">{(prediction.confidence_score * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Prediction Date</p>
                  <p className="text-lg font-semibold">{new Date(prediction.prediction_date).toLocaleDateString()}</p>
                </div>
              </div>

              <button className="btn-primary btn-sm">
                View Recommendations
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Predictions;
