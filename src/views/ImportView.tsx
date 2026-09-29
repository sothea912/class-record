import React, { useState, useRef } from 'react';
import {
  FileUp,
  Download,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Layers,
  Users,
  BookOpen,
  Calendar,
  Sparkles,
  Database,
  Trash2,
  Search,
  Code2,
  Info,
  RefreshCw,
  Plus,
  Eye,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AppState, CustomRecordItem } from '../types';
import {
  parseImportJSON,
  mergeImportIntoState,
  ParsedJSONResult,
  downloadJSONFile,
  generateStudentsSampleJSON,
  generateClassesSampleJSON,
  generateCustomInfoSampleJSON,
} from '../utils/jsonImporter';
import { syncBatchImport, syncSaveCustomRecord, syncDeleteCustomRecord } from '../utils/firestoreSync';
import { uid } from '../utils/helpers';
import { Modal } from '../components/Modal';

interface ImportViewProps {
  state: AppState;
  onApplyImport: (newState: AppState) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const ImportView: React.FC<ImportViewProps> = ({
  state,
  onApplyImport,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'stored' | 'templates'>('upload');

  // Upload & parse state
  const [jsonText, setJsonText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParsedJSONResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [syncToCloud, setSyncToCloud] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showRawEditor, setShowRawEditor] = useState<boolean>(false);

  // Stored Custom Information explorer state
  const [customSearch, setCustomSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Add custom info modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('General Info');
  const [newContentJSON, setNewContentJSON] = useState<string>('{\n  "note": "Custom data record",\n  "status": "Active"\n}');
  const [addModalError, setAddModalError] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<{ id: string; title: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessText = (content: string, name = 'custom-paste.json') => {
    setJsonText(content);
    setFileName(name);
    setFileSize(new Blob([content]).size);
    const parsed = parseImportJSON(content, state);
    setParseResult(parsed);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      onShowToast('Please select a valid .json file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result as string;
      handleProcessText(content, file.name);
    };
    reader.onerror = () => {
      onShowToast('Error reading file from disk.', 'error');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      onShowToast('Only .json files are supported.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result as string;
      handleProcessText(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!parseResult || !parseResult.success) {
      onShowToast('Please load a valid JSON file before importing.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Merge into state
      const merged = mergeImportIntoState(state, parseResult.data, importMode);

      // 2. Dispatch to React AppState and local storage
      onApplyImport(merged);

      // 3. Sync to Cloud Firestore if enabled
      if (syncToCloud) {
        await syncBatchImport(parseResult.data);
      }

      const totalItems =
        parseResult.stats.classCount +
        parseResult.stats.studentCount +
        parseResult.stats.subjectCount +
        parseResult.stats.attendanceCount +
        parseResult.stats.markCount +
        parseResult.stats.classworkCount +
        parseResult.stats.customRecordCount;

      onShowToast(
        `Import complete! Processed ${totalItems} records${syncToCloud ? ' & synced to Cloud Firestore' : ''}.`,
        'success'
      );

      // Reset parse result
      setParseResult(null);
      setJsonText('');
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Import execution error:', err);
      onShowToast(`Import failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add custom record manually
  const handleSaveCustomRecord = async () => {
    setAddModalError('');
    if (!newTitle.trim()) {
      setAddModalError('Title is required.');
      return;
    }

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(newContentJSON);
    } catch (err: any) {
      setAddModalError(`Invalid JSON in content field: ${err?.message}`);
      return;
    }

    const newRecord: CustomRecordItem = {
      id: `custom_${uid()}`,
      title: newTitle.trim(),
      category: newCategory.trim() || 'General Information',
      data: parsedData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextCustom = [newRecord, ...(state.customRecords || [])];
    const nextState = { ...state, customRecords: nextCustom };

    onApplyImport(nextState);
    await syncSaveCustomRecord(newRecord);

    onShowToast(`Saved custom information "${newRecord.title}" to storage & cloud.`, 'success');
    setIsAddModalOpen(false);
    setNewTitle('');
    setNewCategory('General Info');
  };

  // Delete custom record
  const handleDeleteCustomRecord = (id: string, title: string) => {
    setDeleteConfirmId({ id, title });
  };

  const executeDeleteCustomRecord = async () => {
    if (!deleteConfirmId) return;
    const { id, title } = deleteConfirmId;
    const nextCustom = (state.customRecords || []).filter(r => r.id !== id);
    const nextState = { ...state, customRecords: nextCustom };

    onApplyImport(nextState);
    await syncDeleteCustomRecord(id);
    onShowToast(`Removed "${title}" from storage.`, 'info');
    setDeleteConfirmId(null);
  };

  // Filter custom records
  const allCustomRecords = state.customRecords || [];
  const categories = Array.from(
    new Set(allCustomRecords.map(r => r.category || 'General').filter(Boolean))
  );

  const filteredCustomRecords = allCustomRecords.filter(r => {
    const matchesSearch =
      r.title.toLowerCase().includes(customSearch.toLowerCase()) ||
      (r.category && r.category.toLowerCase().includes(customSearch.toLowerCase())) ||
      JSON.stringify(r.data).toLowerCase().includes(customSearch.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || (r.category || 'General') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-600/10 dark:bg-blue-500/10 text-blue-600 dark:text-sky-400 rounded-2xl border border-blue-500/20 shrink-0">
              <FileUp className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Dedicated JSON File Import
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  .JSON Support
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Upload and store information into this website: import student rosters, classes, exam marks, or custom school data with instant Cloud Firestore sync.
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Import JSON</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stored')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'stored'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Stored Info ({allCustomRecords.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'templates'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Templates</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: UPLOAD & IMPORT */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* File Drag-and-Drop Area */}
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all bg-white/60 dark:bg-slate-900/60 backdrop-blur-md ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[0.99]'
                : 'border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
              id="json-file-input"
            />

            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25">
                <FileJson className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Drop your .JSON file here, or browse
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Supports full class backups, student rosters, classes, attendance, or any custom information object.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <label
                  htmlFor="json-file-input"
                  className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                >
                  <FileUp className="w-4 h-4" />
                  <span>Choose .JSON File</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowRawEditor(!showRawEditor)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all"
                >
                  <Code2 className="w-4 h-4 text-slate-500" />
                  <span>{showRawEditor ? 'Hide Code Editor' : 'Paste Raw JSON'}</span>
                </button>
              </div>

              {fileName && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="font-semibold">{fileName}</span>
                  <span className="text-slate-400">({(fileSize / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>
          </div>

          {/* Direct Raw JSON Paste Editor (Optional) */}
          {showRawEditor && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Direct Raw JSON Input
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const obj = JSON.parse(jsonText);
                      setJsonText(JSON.stringify(obj, null, 2));
                      handleProcessText(JSON.stringify(obj, null, 2));
                      onShowToast('JSON formatted', 'info');
                    } catch {
                      onShowToast('Could not format invalid JSON', 'error');
                    }
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-sky-400 hover:underline"
                >
                  Format &amp; Validate
                </button>
              </div>

              <textarea
                value={jsonText}
                onChange={e => handleProcessText(e.target.value)}
                rows={9}
                placeholder='Paste raw JSON here: e.g. [{"name": "Student A", "studentNo": "STD-01"}, {"name": "Student B"}]'
                className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
              />
            </div>
          )}

          {/* Validation & Parsing Result Inspection Card */}
          {parseResult && (
            <div
              className={`rounded-2xl border p-5 sm:p-6 space-y-5 transition-all ${
                parseResult.success
                  ? 'bg-white dark:bg-slate-900 border-emerald-500/40 shadow-sm'
                  : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900'
              }`}
            >
              {/* Header Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  {parseResult.success ? (
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {parseResult.success ? 'Ready to Import' : 'Validation Error in File'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {parseResult.success ? parseResult.summaryText : parseResult.error}
                    </p>
                  </div>
                </div>

                {parseResult.success && (
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Valid JSON
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Sanitized
                    </span>
                  </div>
                )}
              </div>

              {parseResult.success && (
                <>
                  {/* Entity Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        <span>Students</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {parseResult.stats.studentCount}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Classes</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {parseResult.stats.classCount}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium">
                        <BookOpen className="w-3.5 h-3.5 text-purple-500" />
                        <span>Subjects / Exams</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {parseResult.stats.subjectCount + parseResult.stats.markCount}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium">
                        <Database className="w-3.5 h-3.5 text-amber-500" />
                        <span>Custom Info Records</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {parseResult.stats.customRecordCount}
                      </p>
                    </div>
                  </div>

                  {/* Sample Items Preview */}
                  {(parseResult.samplePreview.students.length > 0 ||
                    parseResult.samplePreview.classes.length > 0 ||
                    parseResult.samplePreview.customRecordTitles.length > 0) && (
                    <div className="space-y-3 pt-1">
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Extracted Samples Preview
                      </div>

                      {parseResult.samplePreview.classes.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-400 mr-1">Classes:</span>
                          {parseResult.samplePreview.classes.map(name => (
                            <span
                              key={name}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs border border-indigo-200 dark:border-indigo-800 font-medium"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}

                      {parseResult.samplePreview.students.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-400 mr-1">Students:</span>
                          {parseResult.samplePreview.students.map(name => (
                            <span
                              key={name}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-800 font-medium"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}

                      {parseResult.samplePreview.customRecordTitles.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-400 mr-1">Custom Data:</span>
                          {parseResult.samplePreview.customRecordTitles.map(title => (
                            <span
                              key={title}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs border border-amber-200 dark:border-amber-800 font-medium"
                            >
                              {title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode & Options Settings */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Mode Choice */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                          Import Mode:
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setImportMode('merge')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                              importMode === 'merge'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            🔄 Merge &amp; Upsert (Recommended)
                          </button>
                          <button
                            type="button"
                            onClick={() => setImportMode('replace')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                              importMode === 'replace'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            ⚠️ Overwrite All Records
                          </button>
                        </div>
                      </div>

                      {/* Cloud Sync Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer self-start sm:self-center">
                        <input
                          type="checkbox"
                          checked={syncToCloud}
                          onChange={e => setSyncToCloud(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
                        />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Instantly sync imported data to Cloud Firestore
                        </span>
                      </label>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {importMode === 'merge'
                        ? 'Merge Mode: Keeps existing records. Updates existing items matching by ID or Name, and adds new records.'
                        : 'Overwrite Mode: Replaces existing classes and rosters with the records in this file.'}
                    </p>
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setParseResult(null);
                        setJsonText('');
                        setFileName('');
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleExecuteImport}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processing &amp; Syncing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Commit &amp; Import Data</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STORED INFORMATION EXPLORER */}
      {activeTab === 'stored' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-500" />
                  <span>Stored Custom Information &amp; Records</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Browse and manage arbitrary custom information, announcements, syllabus, and records stored in this app.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-sm shadow-blue-500/20 active:scale-95 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Store New Information</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customSearch}
                  onChange={e => setCustomSearch(e.target.value)}
                  placeholder="Search stored information..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                />
              </div>

              {categories.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Category:</span>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="all">All Categories ({allCustomRecords.length})</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Stored Records Cards */}
          {filteredCustomRecords.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No custom information records found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Import a JSON file containing custom information or click "Store New Information" to save arbitrary data on this website.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCustomRecords.map(rec => {
                const isExpanded = expandedRecordId === rec.id;
                return (
                  <div
                    key={rec.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                            {rec.category || 'Information'}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">
                            {rec.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            ID: {rec.id} &middot; {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString() : ''}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteCustomRecord(rec.id, rec.title)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Delete record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Content Preview */}
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setExpandedRecordId(isExpanded ? null : rec.id)}
                          className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 py-1 hover:text-blue-600"
                        >
                          <span>JSON Payload Details</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isExpanded ? (
                          <pre className="mt-2 p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60 border border-slate-800">
                            {JSON.stringify(rec.data, null, 2)}
                          </pre>
                        ) : (
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono line-clamp-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg mt-1 border border-slate-100 dark:border-slate-800">
                            {JSON.stringify(rec.data)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          downloadJSONFile(rec, `${rec.title.toLowerCase().replace(/\s+/g, '-')}.json`);
                          onShowToast(`Exported "${rec.title}" as JSON.`, 'success');
                        }}
                        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export JSON</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TEMPLATES & DOCUMENTATION */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-600 dark:text-sky-400" />
                <span>Ready-to-Use JSON File Templates</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Download pre-structured JSON sample files. Edit them with your school or student details in any text editor, then upload them in the Import tab.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Template 1: Students Roster */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-3">
                    Student Roster Template
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Structured array of students with names, student numbers, phone, parent contacts, passwords, and custom attributes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    downloadJSONFile(generateStudentsSampleJSON(), 'students-roster-template.json');
                    onShowToast('Downloaded students template', 'success');
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-blue-500" />
                  <span>Download Roster JSON</span>
                </button>
              </div>

              {/* Template 2: Classes & Subjects */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-3">
                    Classes &amp; Subjects Template
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Defines classrooms, meeting timetables, room numbers, curriculum subjects, and grading point weights.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    downloadJSONFile(generateClassesSampleJSON(), 'classes-subjects-template.json');
                    onShowToast('Downloaded classes template', 'success');
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Download Classes JSON</span>
                </button>
              </div>

              {/* Template 3: Custom Information Store */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold">
                    <Database className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-3">
                    Custom Information Template
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Store arbitrary information: school calendar, faculty directory, announcements, or custom institution datasets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    downloadJSONFile(generateCustomInfoSampleJSON(), 'custom-school-info-template.json');
                    onShowToast('Downloaded custom info template', 'success');
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-amber-500" />
                  <span>Download Custom Info JSON</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Store New Custom Information */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Store New Custom Information"
      >
        <div className="space-y-4">
          {addModalError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{addModalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Title / Record Name *
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="e.g. Science Fair Schedule or Faculty Directory"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Category
            </label>
            <input
              type="text"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              placeholder="e.g. Announcements, Calendar, Staff, Syllabus"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              JSON Content / Payload *
            </label>
            <textarea
              value={newContentJSON}
              onChange={e => setNewContentJSON(e.target.value)}
              rows={7}
              placeholder="Valid JSON object or array"
              className="w-full p-3 font-mono text-xs bg-slate-950 text-emerald-400 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCustomRecord}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 active:scale-95 transition-all"
            >
              Save Information
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Confirm Custom Record Deletion"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteConfirmId(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={executeDeleteCustomRecord}
              className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
            >
              Delete Permanently
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Are you sure you want to permanently delete custom record &ldquo;<span className="font-semibold text-slate-800 dark:text-white">{deleteConfirmId?.title}</span>&rdquo;? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};
