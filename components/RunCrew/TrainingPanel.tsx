'use client';

import { useState } from 'react';
import { Edit2, Save, X } from 'lucide-react';

interface Coach {
  name: string;
  avatarUrl: string;
}

interface WeekOutlook {
  focus: string;
  intensity: string;
  goal: string;
}

interface Training {
  role: string;
  title: string;
  miles?: number;
  effort: string;
  notes: string;
}

interface TrainingWeek {
  coach: Coach;
  coachAdvice: string;
  weekOutlook: WeekOutlook;
  trainings: Training[];
}

interface TrainingPanelProps {
  trainingWeek: TrainingWeek;
}

export default function TrainingPanel({ trainingWeek }: TrainingPanelProps) {
  const [isEditingAdvice, setIsEditingAdvice] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState(trainingWeek.coachAdvice);

  const handleSaveAdvice = () => {
    // In real implementation, this would save to backend
    setIsEditingAdvice(false);
  };

  const handleCancelEdit = () => {
    setCoachAdvice(trainingWeek.coachAdvice);
    setIsEditingAdvice(false);
  };

  return (
    <div className="space-y-6">
      {/* Coach Presence */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-4">
          {trainingWeek.coach.avatarUrl ? (
            <img
              src={trainingWeek.coach.avatarUrl}
              alt={trainingWeek.coach.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl font-semibold border-2 border-gray-200">
              {trainingWeek.coach.name[0].toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{trainingWeek.coach.name}</h3>
            <p className="text-sm text-gray-500 font-medium">Coach</p>
          </div>
        </div>
      </section>

      {/* Coach Advice */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Coach Advice</h2>
          {!isEditingAdvice && (
            <button
              onClick={() => setIsEditingAdvice(true)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              title="Edit advice"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {isEditingAdvice ? (
          <div className="space-y-3">
            <textarea
              value={coachAdvice}
              onChange={(e) => setCoachAdvice(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm text-gray-900 resize-none"
              rows={4}
              placeholder="Share your guidance..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveAdvice}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {coachAdvice}
          </p>
        )}
      </section>

      {/* Week Outlook */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Week Outlook</h2>
        <ul className="space-y-2">
          <li className="flex items-start gap-3">
            <span className="text-orange-500 font-semibold mt-0.5">Focus:</span>
            <span className="text-sm text-gray-700">{trainingWeek.weekOutlook.focus}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-orange-500 font-semibold mt-0.5">Intensity:</span>
            <span className="text-sm text-gray-700">{trainingWeek.weekOutlook.intensity}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-orange-500 font-semibold mt-0.5">Goal:</span>
            <span className="text-sm text-gray-700">{trainingWeek.weekOutlook.goal}</span>
          </li>
        </ul>
      </section>

      {/* Trainings */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">This Week's Training</h2>
        <div className="space-y-4">
          {trainingWeek.trainings.map((training, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-xl p-4 hover:border-orange-300 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                      {training.role}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-2">
                    {training.title}
                  </h3>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                {training.miles && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>{training.miles} miles</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="font-medium">{training.effort}</span>
                </div>
                {training.notes && (
                  <p className="text-gray-600 text-xs mt-2 italic">"{training.notes}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

