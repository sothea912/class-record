import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Clock,
  Calendar,
  MapPin,
  Users,
  FilePenLine,
  Edit2,
  Trash2,
  Check,
  X,
  FileUp,
} from 'lucide-react';
import { AppState, ClassItem, StudentItem } from '../types';
import { studentsOf, subjectsOf, uid } from '../utils/helpers';
import { Modal } from '../components/Modal';

interface ClassesViewProps {
  state: AppState;
  onSaveClass: (cls: ClassItem) => void;
  onDeleteClass: (classId: string) => void;
  onUpdateRoster: (classId: string, studentIds: string[]) => void;
  onNavigate?: (view: any) => void;
}

export const ClassesView: React.FC<ClassesViewProps> = ({
  state,
  onSaveClass,
  onDeleteClass,
  onUpdateRoster,
  onNavigate,
}) => {
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [timeFrom, setTimeFrom] = useState('19:00');
  const [timeTo, setTimeTo] = useState('20:30');
  const [days, setDays] = useState('Mon–Fri');
  const [room, setRoom] = useState('Room 101');
  const [meetLink, setMeetLink] = useState('');

  // Roster Modal State
  const [rosterClass, setRosterClass] = useState<ClassItem | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const openAddClass = () => {
    setEditingClass(null);
    setName('');
    setLevel('');
    setTimeFrom(state.profile.timeFrom || '19:00');
    setTimeTo(state.profile.timeTo || '20:30');
    setDays('Mon–Fri');
    setRoom('Room 101');
    setMeetLink('');
    setIsClassModalOpen(true);
  };

  const openEditClass = (c: ClassItem) => {
    setEditingClass(c);
    setName(c.name);
    setLevel(c.level || '');
    setTimeFrom(c.timeFrom || '19:00');
    setTimeTo(c.timeTo || '20:30');
    setDays(c.days || 'Mon–Fri');
    setRoom(c.room || '');
    setMeetLink(c.meetLink || '');
    setIsClassModalOpen(true);
  };

  const handleSaveClass = () => {
    if (!name.trim()) {
      alert('Please enter a class name');
      return;
    }
    const cObj: ClassItem = {
      id: editingClass ? editingClass.id : uid('c'),
      name: name.trim(),
      level: level.trim(),
      timeFrom,
      timeTo,
      days: days.trim(),
      room: room.trim(),
      meetLink: meetLink.trim(),
    };
    onSaveClass(cObj);
    setIsClassModalOpen(false);
  };

  const openRoster = (c: ClassItem) => {
    setRosterClass(c);
    const enrolled = state.students
      .filter(s => s.classIds && s.classIds.includes(c.id))
      .map(s => s.id);
    setSelectedStudentIds(enrolled);
  };

  const handleSaveRoster = () => {
    if (!rosterClass) return;
    onUpdateRoster(rosterClass.id, selectedStudentIds);
    setRosterClass(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Class Timetables &amp; Courses
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Organize schedules, assign subjects, and manage student rosters
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('import')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-sm active:scale-95 transition-all"
            >
              <FileUp className="w-3.5 h-3.5 text-blue-500" />
              <span>Import JSON</span>
            </button>
          )}
          <button
            type="button"
            onClick={openAddClass}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-500/25 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Class</span>
          </button>
        </div>
      </div>

      {/* Classes Grid */}
      {state.classes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No classes registered</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create your first class to begin managing students, attendance, and exam scores.
          </p>
          <button
            type="button"
            onClick={openAddClass}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
          >
            Create Class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {state.classes.map(c => {
            const enrolled = studentsOf(c.id, state);
            const subs = subjectsOf(c.id, state);

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Header Title & Level */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      {c.name}
                    </h3>
                    {c.level && (
                      <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-900 shrink-0">
                        {c.level}
                      </span>
                    )}
                  </div>

                  {/* Meta items */}
                  <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400 mt-3">
                    {(c.timeFrom || c.timeTo) && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-700 dark:text-slate-200 font-mono">
                          {c.timeFrom} – {c.timeTo}
                        </span>
                      </div>
                    )}

                    {c.days && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{c.days}</span>
                      </div>
                    )}

                    {c.room && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{c.room}</span>
                      </div>
                    )}
                  </div>

                  {/* Metrics Badges */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <span>{enrolled.length} Students</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      <FilePenLine className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{subs.length} Subjects</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
                  <button
                    type="button"
                    onClick={() => openRoster(c)}
                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Manage Roster
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditClass(c)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Edit Class Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteClass(c.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Delete Class"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Class Add/Edit Modal */}
      <Modal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        title={editingClass ? `Edit Class: ${editingClass.name}` : 'Create New Class'}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsClassModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveClass}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-500/25"
            >
              {editingClass ? 'Save Changes' : 'Create Class'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="sm:col-span-2">
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Class Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Evening English A"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Level / Description
            </label>
            <input
              type="text"
              value={level}
              onChange={e => setLevel(e.target.value)}
              placeholder="e.g. Upper Intermediate"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Room / Zoom Link
            </label>
            <input
              type="text"
              value={room}
              onChange={e => setRoom(e.target.value)}
              placeholder="e.g. Room 203 or Zoom Room 1"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Class Starts
            </label>
            <input
              type="time"
              value={timeFrom}
              onChange={e => setTimeFrom(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Class Ends
            </label>
            <input
              type="time"
              value={timeTo}
              onChange={e => setTimeTo(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Schedule Days
            </label>
            <input
              type="text"
              value={days}
              onChange={e => setDays(e.target.value)}
              placeholder="e.g. Mon–Fri or Sat–Sun"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Google Meet Link / Virtual Classroom URL
            </label>
            <input
              type="url"
              value={meetLink}
              onChange={e => setMeetLink(e.target.value)}
              placeholder="e.g. https://meet.google.com/abc-defg-hij"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* Roster Assignment Modal */}
      {rosterClass && (
        <Modal
          isOpen={true}
          onClose={() => setRosterClass(null)}
          title={`Enrollment Roster: ${rosterClass.name}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setRosterClass(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoster}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-500/25"
              >
                Update Roster ({selectedStudentIds.length})
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select all students who belong in this class roster. Changes update attendance registers and scoring matrix automatically.
            </p>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
              {state.students.map(s => {
                const isSelected = selectedStudentIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex items-center justify-between p-3 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedStudentIds([...selectedStudentIds, s.id]);
                          } else {
                            setSelectedStudentIds(selectedStudentIds.filter(id => id !== s.id));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <div className="flex items-center gap-2">
                        {s.photo ? (
                          <img src={s.photo} alt={s.name} className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-xs font-semibold flex items-center justify-center">
                            {s.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {s.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">{s.studentNo || 'No ID'}</p>
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Enrolled</span>
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
