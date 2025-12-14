'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface TrainingSchema {
  id: string;
  name: string;
  description: string | null;
  schemaJson: any;
  createdAt: string;
  updatedAt: string;
}

export default function TrainingSchemaAdminPage() {
  const [trainingSchemas, setTrainingSchemas] = useState<TrainingSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    schemaJson: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTrainingSchemas();
  }, []);

  const loadTrainingSchemas = async () => {
    try {
      setLoading(true);
      const response = await api.get('/training-schema');
      
      if (response.data.success) {
        setTrainingSchemas(response.data.data);
      } else {
        setError('Failed to load training schemas');
      }
    } catch (error: any) {
      console.error('Error loading training schemas:', error);
      setError(error.response?.data?.error || 'Failed to load training schemas');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schema: TrainingSchema) => {
    setEditingId(schema.id);
    setEditForm({
      name: schema.name,
      description: schema.description || '',
      schemaJson: JSON.stringify(schema.schemaJson, null, 2),
    });
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({
      name: '',
      description: '',
      schemaJson: '',
    });
    setError(null);
  };

  const handleSave = async (id: string) => {
    try {
      setSaving(true);
      setError(null);

      // Validate JSON
      let parsedJson;
      try {
        parsedJson = JSON.parse(editForm.schemaJson);
      } catch (e) {
        setError('Invalid JSON format. Please check your JSON syntax.');
        setSaving(false);
        return;
      }

      const response = await api.put(`/training-schema/${id}`, {
        name: editForm.name,
        description: editForm.description || null,
        schemaJson: parsedJson,
      });

      if (response.data.success) {
        setEditingId(null);
        loadTrainingSchemas();
      } else {
        setError(response.data.error || 'Failed to save training schema');
      }
    } catch (error: any) {
      console.error('Error saving training schema:', error);
      setError(error.response?.data?.error || 'Failed to save training schema');
    } finally {
      setSaving(false);
    }
  };

  const handleUpsertDefault = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await api.post('/training-schema/upsert-default');
      
      if (response.data.success) {
        loadTrainingSchemas();
      } else {
        setError(response.data.error || 'Failed to upsert default training schema');
      }
    } catch (error: any) {
      console.error('Error upserting default training schema:', error);
      setError(error.response?.data?.error || 'Failed to upsert default training schema');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Training Schema Admin</h1>
          <p className="text-gray-600 mb-4">
            Manage training-related Prisma fields allowed for prompt hydration.
          </p>
          <button
            onClick={handleUpsertDefault}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Loading...' : 'Upsert Default Schema'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {trainingSchemas.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-500">No training schemas found. Click "Upsert Default Schema" to create one.</p>
            </div>
          ) : (
            trainingSchemas.map((schema) => (
              <div key={schema.id} className="bg-white rounded-lg shadow p-6">
                {editingId === schema.id ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Schema JSON
                      </label>
                      <textarea
                        value={editForm.schemaJson}
                        onChange={(e) => setEditForm({ ...editForm, schemaJson: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        rows={12}
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Paste or edit the JSON blob manually. Must be valid JSON.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(schema.id)}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">{schema.name}</h2>
                        {schema.description && (
                          <p className="text-gray-600 mt-1">{schema.description}</p>
                        )}
                        <p className="text-sm text-gray-500 mt-2">
                          Created: {new Date(schema.createdAt).toLocaleString()} | 
                          Updated: {new Date(schema.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleEdit(schema)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Edit
                      </button>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Schema JSON
                      </label>
                      <pre className="bg-gray-50 border border-gray-200 rounded-md p-4 overflow-x-auto text-sm font-mono">
                        {JSON.stringify(schema.schemaJson, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
