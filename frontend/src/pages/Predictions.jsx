import { useState, useEffect } from 'react';
import { predictionsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Predictions() {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState([]);
  const [selectedDisease, setSelectedDisease] = useState('Flu');
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const diseases = ['Flu', 'COVID-19', 'Dengue', 'Malaria', 'Typhoid', 'Common Cold', 'Pneumonia'];

  // Fetch predictions on mount
  useEffect(() => {
    fetchPredictions();
  }, []);

  // Fetch recommendations when disease changes
  useEffect(() => {
    if (selectedDisease) {
      fetchRecommendations(selectedDisease);
    }
  }, [selectedDisease]);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const data = await predictionsAPI.getAll();
      setPredictions(data.data || []);
      setError('');
    } catch (err) {
      setError('Failed to load predictions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async (disease) => {
    try {
      const data = await predictionsAPI.getMedicineRecommendations(disease);
      setRecommendations(data.data);
      setError('');
    } catch (err) {
      console.error('Failed to load recommendations:', err);
      setError('Failed to load recommendations');
    }
  };

  const triggerPredictions = async () => {
    if (user?.role !== 'admin') {
      setError('Only admins can trigger predictions');
      return;
    }

    try {
      setTriggering(true);
      const data = await predictionsAPI.trigger();
      
      if (data.success) {
        setSuccess('Prediction generated successfully!');
        fetchPredictions();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to trigger prediction. Make sure sales data exists.');
      console.error(err);
    } finally {
      setTriggering(false);
    }
  };

  const getRiskLevelColor = (riskLevel) => {
    switch (riskLevel?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-50 border-l-4 border-red-500';
      case 'medium':
        return 'bg-yellow-50 border-l-4 border-yellow-500';
      case 'low':
        return 'bg-blue-50 border-l-4 border-blue-500';
      default:
        return 'bg-gray-50 border-l-4 border-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Disease Outbreak Predictions</h1>
          <p className="text-gray-600">ML-powered disease prediction and medicine recommendations</p>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Disease Selection & Recommendations */}
          <div className="lg:col-span-2">
            {/* Disease Selection */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Medicine Recommendations</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Disease
                </label>
                <select
                  value={selectedDisease}
                  onChange={(e) => setSelectedDisease(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {diseases.map((disease) => (
                    <option key={disease} value={disease}>
                      {disease}
                    </option>
                  ))}
                </select>
              </div>

              {/* Demand & Duration Info */}
              {recommendations && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Expected Demand Increase</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {recommendations.expected_demand_increase}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Expected Duration</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {recommendations.expected_duration}
                    </p>
                  </div>
                </div>
              )}

              {/* Recommendations List */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended Medicines</h3>
                {recommendations && recommendations.recommended_medicines && recommendations.recommended_medicines.length > 0 ? (
                  <div className="space-y-3">
                    {recommendations.recommended_medicines.map((rec, idx) => (
                      <div key={idx} className={`p-4 rounded-lg ${getPriorityColor(rec.priority)}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900">{rec.name}</h4>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                rec.priority === 'high' ? 'bg-red-200 text-red-800' :
                                rec.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                                'bg-blue-200 text-blue-800'
                              }`}>
                                {rec.priority?.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{rec.reason}</p>
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">Dosage:</span> {rec.dosage}
                            </p>
                            {rec.current_stock !== null && (
                              <p className="text-xs text-gray-600 mt-1">
                                <span className="font-medium">Current Stock:</span> {rec.current_stock} units
                              </p>
                            )}
                          </div>
                          {rec.db_price && (
                            <div className="ml-4 text-right">
                              <p className="text-sm font-semibold text-gray-900">
                                ₹{rec.db_price.toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No recommendations available</p>
                )}
              </div>
            </div>


          </div>

          {/* Right Column: Latest Predictions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Latest Predictions</h2>
                {user?.role === 'admin' && (
                  <button
                    onClick={triggerPredictions}
                    disabled={triggering || loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                  >
                    {triggering ? 'Running...' : 'Generate New'}
                  </button>
                )}
              </div>

              {loading && !predictions.length ? (
                <p className="text-gray-500">Loading predictions...</p>
              ) : predictions.length > 0 ? (
                <div className="space-y-3">
                  {predictions.slice(0, 5).map((pred) => (
                    <div
                      key={pred.prediction_id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{pred.predicted_disease}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskLevelColor(pred.risk_level)}`}>
                          {pred.risk_level?.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium">Confidence:</span> {(pred.confidence_score * 100).toFixed(0)}%
                        </p>
                        <p>
                          <span className="font-medium">Region:</span> {pred.predicted_region || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(pred.prediction_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No predictions yet</p>
                  {user?.role === 'admin' && (
                    <button
                      onClick={triggerPredictions}
                      disabled={triggering}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
                    >
                      {triggering ? 'Generating...' : 'Generate First Prediction'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
