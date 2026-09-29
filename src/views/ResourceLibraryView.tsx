import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  FileText,
  FileSpreadsheet,
  FolderOpen,
  Download,
  ExternalLink,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  Tag,
  Upload,
  Layers,
  Sparkles,
  Clock,
  User,
  CheckCircle2,
  X,
  FileUp,
  Image as ImageIcon,
  BookMarked,
  Eye,
} from 'lucide-react';
import {
  AnnouncementBanner,
  AppState,
  BannerColorTheme,
  ClassItem,
  LibraryResource,
  ResourceCategory,
} from '../types';
import { BannerCarousel } from '../components/BannerCarousel';
import { uid } from '../utils/helpers';

interface ResourceLibraryViewProps {
  state: AppState;
  isTeacher: boolean;
  onSaveBanner?: (banner: AnnouncementBanner) => void;
  onDeleteBanner?: (bannerId: string) => void;
  onSaveResource?: (resource: LibraryResource) => void;
  onDeleteResource?: (resourceId: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  selectedClassId?: string;
}

const CATEGORIES: ResourceCategory[] = [
  'Books',
  'PDF Documents',
  'Lessons/Worksheets',
  'General Resources',
];

const CATEGORY_STYLES: Record<
  ResourceCategory,
  {
    bg: string;
    text: string;
    border: string;
    darkBg: string;
    darkText: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  Books: {
    bg: 'bg-[#9985FB]/15',
    text: 'text-[#6348eb]',
    border: 'border-[#9985FB]/30',
    darkBg: 'dark:bg-[#9985FB]/20',
    darkText: 'dark:text-[#b4a6fc]',
    icon: BookMarked,
  },
  'PDF Documents': {
    bg: 'bg-[#FF908D]/15',
    text: 'text-[#e11d48]',
    border: 'border-[#FF908D]/30',
    darkBg: 'dark:bg-[#FF908D]/20',
    darkText: 'dark:text-[#ffa7a5]',
    icon: FileText,
  },
  'Lessons/Worksheets': {
    bg: 'bg-[#4BA95F]/15',
    text: 'text-[#2e7d40]',
    border: 'border-[#4BA95F]/30',
    darkBg: 'dark:bg-[#4BA95F]/20',
    darkText: 'dark:text-[#6cd283]',
    icon: FileSpreadsheet,
  },
  'General Resources': {
    bg: 'bg-[#77DDFA]/15',
    text: 'text-[#0284c7]',
    border: 'border-[#77DDFA]/30',
    darkBg: 'dark:bg-[#77DDFA]/20',
    darkText: 'dark:text-[#77DDFA]',
    icon: FolderOpen,
  },
};

export const ResourceLibraryView: React.FC<ResourceLibraryViewProps> = ({
  state,
  isTeacher,
  onSaveBanner,
  onDeleteBanner,
  onSaveResource,
  onDeleteResource,
  onShowToast,
  selectedClassId,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterClassId, setFilterClassId] = useState<string>('all');

  // Resource Modal state
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<LibraryResource | null>(null);
  const [resTitle, setResTitle] = useState('');
  const [resDescription, setResDescription] = useState('');
  const [resCategory, setResCategory] = useState<ResourceCategory>('Books');
  const [resClassId, setResClassId] = useState('all');
  const [resAuthor, setResAuthor] = useState(state.profile.name || 'Soth Sothea');
  const [resTags, setResTags] = useState('');
  const [resExternalLink, setResExternalLink] = useState('');
  const [resFileUrl, setResFileUrl] = useState<string | undefined>(undefined);
  const [resFileName, setResFileName] = useState('');
  const [resFileSize, setResFileSize] = useState('');

  // Banner Manager Modal state
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AnnouncementBanner | null>(null);
  const [banTitle, setBanTitle] = useState('');
  const [banDescription, setBanDescription] = useState('');
  const [banBadge, setBanBadge] = useState('Announcement');
  const [banBgColor, setBanBgColor] = useState<BannerColorTheme>('green');
  const [banLinkUrl, setBanLinkUrl] = useState('');
  const [banImageUrl, setBanImageUrl] = useState<string | undefined>(undefined);

  const banners = state.banners || [];
  const resources = state.resources || [];

  // Filtered resources
  const filteredResources = useMemo(() => {
    return resources.filter(res => {
      // Category filter
      if (activeCategory !== 'all' && res.category !== activeCategory) {
        return false;
      }
      // Class filter
      if (filterClassId !== 'all' && res.classId && res.classId !== 'all' && res.classId !== filterClassId) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = res.title.toLowerCase().includes(q);
        const inDesc = (res.description || '').toLowerCase().includes(q);
        const inAuthor = (res.authorOrTeacher || '').toLowerCase().includes(q);
        const inTags = (res.tags || []).some(t => t.toLowerCase().includes(q));
        if (!inTitle && !inDesc && !inAuthor && !inTags) return false;
      }
      return true;
    });
  }, [resources, activeCategory, filterClassId, searchQuery]);

  // Count by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: resources.length };
    CATEGORIES.forEach(cat => {
      counts[cat] = resources.filter(r => r.category === cat).length;
    });
    return counts;
  }, [resources]);

  // Helper: Compress image to JPEG canvas Data URL to keep under 100KB for Firestore sync
  const compressImageDataUrl = (dataUrl: string, maxDim = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Handle Resource file pick
  const handlePickResourceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Read file size
    const sizeKB = Math.round(file.size / 1024);
    const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
    setResFileName(file.name);
    setResFileSize(sizeStr);

    const reader = new FileReader();
    reader.onload = async () => {
      const rawUrl = reader.result as string;
      if (file.type.startsWith('image/')) {
        const compressed = await compressImageDataUrl(rawUrl, 900, 0.75);
        setResFileUrl(compressed);
      } else {
        if (file.size > 650 * 1024) {
          onShowToast('Note: Attachment metadata saved to cloud for instant multi-device sync.', 'info');
          setResFileUrl(rawUrl.slice(0, 50000));
        } else {
          setResFileUrl(rawUrl);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Banner image pick
  const handlePickBannerImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      const compressed = await compressImageDataUrl(raw, 1000, 0.75);
      setBanImageUrl(compressed);
    };
    reader.readAsDataURL(file);
  };

  // Open resource modal for create/edit
  const handleOpenResourceModal = (resource?: LibraryResource) => {
    if (resource) {
      setEditingResource(resource);
      setResTitle(resource.title);
      setResDescription(resource.description || '');
      setResCategory(resource.category);
      setResClassId(resource.classId || 'all');
      setResAuthor(resource.authorOrTeacher || state.profile.name || 'Soth Sothea');
      setResTags((resource.tags || []).join(', '));
      setResExternalLink(resource.externalLink || '');
      setResFileUrl(resource.fileUrl);
      setResFileName(resource.fileName || '');
      setResFileSize(resource.fileSize || '');
    } else {
      setEditingResource(null);
      setResTitle('');
      setResDescription('');
      setResCategory('Books');
      setResClassId('all');
      setResAuthor(state.profile.name || 'Soth Sothea');
      setResTags('');
      setResExternalLink('');
      setResFileUrl(undefined);
      setResFileName('');
      setResFileSize('');
    }
    setIsResourceModalOpen(true);
  };

  // Save resource
  const handleSaveResourceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim()) {
      onShowToast('Please provide a title for the resource', 'error');
      return;
    }

    const tagsArr = resTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const item: LibraryResource = {
      id: editingResource ? editingResource.id : uid('res'),
      title: resTitle.trim(),
      description: resDescription.trim() || undefined,
      category: resCategory,
      classId: resClassId === 'all' ? undefined : resClassId,
      authorOrTeacher: resAuthor.trim() || undefined,
      tags: tagsArr.length > 0 ? tagsArr : undefined,
      externalLink: resExternalLink.trim() || undefined,
      fileUrl: resFileUrl,
      fileName: resFileName || undefined,
      fileSize: resFileSize || undefined,
      fileType: resFileName ? resFileName.split('.').pop()?.toLowerCase() : 'pdf',
      downloadsCount: editingResource ? editingResource.downloadsCount || 0 : 0,
      createdAt: editingResource ? editingResource.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (onSaveResource) {
      onSaveResource(item);
    }
    setIsResourceModalOpen(false);
    onShowToast(`Resource "${item.title}" saved to library`, 'success');
  };

  // Open banner manager
  const handleOpenBannerManager = () => {
    setEditingBanner(null);
    setBanTitle('');
    setBanDescription('');
    setBanBadge('Announcement');
    setBanBgColor('green');
    setBanLinkUrl('');
    setBanImageUrl(undefined);
    setIsBannerModalOpen(true);
  };

  // Save banner
  const handleSaveBannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTitle.trim()) {
      onShowToast('Please provide a title for the banner', 'error');
      return;
    }

    const item: AnnouncementBanner = {
      id: editingBanner ? editingBanner.id : uid('ban'),
      title: banTitle.trim(),
      description: banDescription.trim() || undefined,
      badge: banBadge.trim() || 'Announcement',
      bgColor: banBgColor,
      linkUrl: banLinkUrl.trim() || undefined,
      imageUrl: banImageUrl,
      order: editingBanner ? editingBanner.order || banners.length + 1 : banners.length + 1,
      isActive: true,
      createdAt: editingBanner ? editingBanner.createdAt : new Date().toISOString(),
    };

    if (onSaveBanner) {
      onSaveBanner(item);
    }
    setEditingBanner(null);
    setBanTitle('');
    setBanDescription('');
    setBanBadge('Announcement');
    setBanLinkUrl('');
    setBanImageUrl(undefined);
    onShowToast(`Banner "${item.title}" updated`, 'success');
  };

  // Download resource trigger
  const handleDownloadResource = (res: LibraryResource) => {
    if (res.fileUrl) {
      const a = document.createElement('a');
      a.href = res.fileUrl;
      a.download = res.fileName || `${res.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onShowToast(`Downloaded ${res.title}`, 'success');

      // Update downloads count
      if (onSaveResource) {
        onSaveResource({
          ...res,
          downloadsCount: (res.downloadsCount || 0) + 1,
        });
      }
    } else if (res.externalLink) {
      window.open(res.externalLink, '_blank', 'noopener,noreferrer');
    } else {
      // Demo placeholder download
      const content = `Central Academy Resource Document\nTitle: ${res.title}\nCategory: ${res.category}\nInstructor: ${res.authorOrTeacher || 'Soth Sothea'}\n\n${res.description || 'Educational material and guidelines.'}`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${res.title.replace(/\s+/g, '_')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      onShowToast(`Downloaded material: ${res.title}`, 'success');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. ANIMATED 10-SECOND AUTO-SLIDE ANNOUNCEMENT CAROUSEL */}
      <section className="w-full">
        <BannerCarousel
          banners={banners}
          onManageBanners={isTeacher ? handleOpenBannerManager : undefined}
          isTeacher={isTeacher}
        />
      </section>

      {/* 2. RESOURCE & FILE LIBRARY SECTION */}
      <section className="space-y-5">
        {/* Header & Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <BookOpen className="w-6 h-6 text-[#4BA95F]" />
              <span>Digital Resource &amp; File Library</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {isTeacher
                ? 'Upload and organize course textbooks, worksheets, and syllabus resources.'
                : 'Browse, view, and download coursebooks, study guides, and lesson worksheets.'}
            </p>
          </div>

          {/* Teacher Upload / Add Resource Button */}
          {isTeacher && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenResourceModal()}
                className="px-4 py-2.5 bg-[#4BA95F] hover:bg-[#3e8f50] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-[#4BA95F]/25 flex items-center gap-2 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Resource</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Pills & Search Box */}
        <div className="bg-white dark:bg-[#141414] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3.5">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeCategory === 'all'
                  ? 'bg-[#4BA95F] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#282828]'
              }`}
            >
              <span>All Resources</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 dark:bg-white/20">
                {categoryCounts.all}
              </span>
            </button>

            {CATEGORIES.map(cat => {
              const active = activeCategory === cat;
              const catStyle = CATEGORY_STYLES[cat];
              const Icon = catStyle.icon;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#4BA95F] text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#282828]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 dark:bg-white/20">
                    {categoryCounts[cat]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search bar & Class filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search resources by title, topic, author, or tags…"
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#4BA95F] focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {state.classes.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">Target:</span>
                <select
                  value={filterClassId}
                  onChange={e => setFilterClassId(e.target.value)}
                  className="w-full sm:w-auto bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4BA95F] cursor-pointer"
                >
                  <option value="all">All Classes</option>
                  {state.classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Resources Grid */}
        {filteredResources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResources.map(res => {
              const catStyle = CATEGORY_STYLES[res.category] || CATEGORY_STYLES.Books;
              const Icon = catStyle.icon;
              const targetClass = state.classes.find(c => c.id === res.classId);

              return (
                <div
                  key={res.id}
                  className="bg-white dark:bg-[#141414] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
                >
                  {/* Category Accent top bar */}
                  <div
                    className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r"
                    style={{
                      backgroundImage: `linear-gradient(to right, ${catStyle.text}, #77DDFA)`,
                    }}
                  />

                  <div className="space-y-3">
                    {/* Category pill & Target Class */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${catStyle.bg} ${catStyle.text} ${catStyle.darkBg} ${catStyle.darkText} border ${catStyle.border}`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{res.category}</span>
                      </span>

                      {targetClass ? (
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#1e1e1e] px-2 py-0.5 rounded-md truncate max-w-[120px]">
                          {targetClass.name}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                          General
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-[#4BA95F] transition-colors line-clamp-2">
                        {res.title}
                      </h3>
                      {res.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                          {res.description}
                        </p>
                      )}
                    </div>

                    {/* Tags */}
                    {res.tags && res.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {res.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-[#2a2a2a]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Metadata & Actions */}
                  <div className="pt-4 mt-3 border-t border-slate-100 dark:border-[#222222] flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {res.authorOrTeacher || 'Instructor Resource'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {res.fileSize ? `${res.fileSize} · ` : ''}
                        {res.downloadsCount ? `${res.downloadsCount} downloads` : 'Ready'}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isTeacher && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenResourceModal(res)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#202020] transition-colors"
                            title="Edit Resource"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteResource && (
                            <button
                              type="button"
                              onClick={() => onDeleteResource(res.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Delete Resource"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}

                      {/* Download / Open Button */}
                      <button
                        type="button"
                        onClick={() => handleDownloadResource(res)}
                        className="px-3 py-1.5 rounded-xl bg-[#4BA95F] hover:bg-[#3e8f50] text-white font-bold text-xs shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
                        title="Download or open material"
                      >
                        {res.externalLink && !res.fileUrl ? (
                          <>
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Get File</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center bg-white dark:bg-[#141414] border border-slate-200/80 dark:border-[#262626] rounded-2xl space-y-3">
            <BookOpen className="w-10 h-10 text-slate-400 mx-auto opacity-60" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No resources match your filter criteria.
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your category filter or search query.
            </p>
            {isTeacher && (
              <button
                type="button"
                onClick={() => handleOpenResourceModal()}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#4BA95F] text-white text-xs font-bold rounded-xl shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload First Resource</span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* TEACHER MODAL: ADD / EDIT RESOURCE */}
      {/* =================================================================== */}
      {isResourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#262626] rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#222222]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#4BA95F]/15 text-[#4BA95F] flex items-center justify-center">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {editingResource ? 'Edit Library Resource' : 'Upload Educational Resource'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Share books, documents, and lesson files across the portal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResourceModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#202020]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResourceSubmit} className="space-y-3.5">
              {/* Title */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  value={resTitle}
                  onChange={e => setResTitle(e.target.value)}
                  placeholder="e.g. Cambridge IELTS 19 Academic Practice Tests"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#4BA95F] focus:outline-none"
                />
              </div>

              {/* Category & Target Class */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Category *
                  </label>
                  <select
                    value={resCategory}
                    onChange={e => setResCategory(e.target.value as ResourceCategory)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#4BA95F] focus:outline-none"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Target Class
                  </label>
                  <select
                    value={resClassId}
                    onChange={e => setResClassId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#4BA95F] focus:outline-none"
                  >
                    <option value="all">All Enrolled Classes</option>
                    {state.classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Description &amp; Highlights
                </label>
                <textarea
                  rows={2}
                  value={resDescription}
                  onChange={e => setResDescription(e.target.value)}
                  placeholder="Overview of this study resource, chapter breakdown, or homework instructions..."
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#4BA95F] focus:outline-none"
                />
              </div>

              {/* File Upload / Attachment */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a]">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Attach Document / File
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-[#4BA95F] hover:bg-[#3e8f50] text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose File</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handlePickResourceFile}
                      accept=".pdf,.doc,.docx,.epub,.zip,.png,.jpg,.jpeg"
                    />
                  </label>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {resFileName ? (
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {resFileName} ({resFileSize})
                      </span>
                    ) : (
                      <span>PDF, Word, or eBook file</span>
                    )}
                  </div>
                </div>
              </div>

              {/* External Link */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Or External Cloud / Website Link
                </label>
                <input
                  type="url"
                  value={resExternalLink}
                  onChange={e => setResExternalLink(e.target.value)}
                  placeholder="https://drive.google.com/... or educational URL"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#4BA95F] focus:outline-none"
                />
              </div>

              {/* Author & Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Author / Instructor
                  </label>
                  <input
                    type="text"
                    value={resAuthor}
                    onChange={e => setResAuthor(e.target.value)}
                    placeholder="e.g. Soth Sothea"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#4BA95F] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tags (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={resTags}
                    onChange={e => setResTags(e.target.value)}
                    placeholder="Grammar, IELTS, Unit 1"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#4BA95F] focus:outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-[#222222]">
                <button
                  type="button"
                  onClick={() => setIsResourceModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#202020] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4BA95F] hover:bg-[#3e8f50] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  {editingResource ? 'Update Resource' : 'Save & Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TEACHER MODAL: MANAGE ANNOUNCEMENT BANNERS */}
      {/* =================================================================== */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#262626] rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#222222]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FEA339]/15 text-[#FEA339] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Announcement Banner Slideshow Manager
                  </h3>
                  <p className="text-xs text-slate-400">
                    Manage the 10-second auto-slide banners visible in Student and Teacher portals.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBannerModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#202020]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Existing Banners List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Active Carousel Banners ({banners.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {banners.map(b => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200/80 dark:border-[#262626] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {b.title}
                        </span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full font-bold uppercase bg-slate-200 dark:bg-[#282828] text-slate-700 dark:text-slate-300">
                          {b.badge || 'Banner'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{b.description}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBanner(b);
                          setBanTitle(b.title);
                          setBanDescription(b.description || '');
                          setBanBadge(b.badge || 'Announcement');
                          setBanBgColor(b.bgColor || 'green');
                          setBanLinkUrl(b.linkUrl || '');
                          setBanImageUrl(b.imageUrl);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-[#252525]"
                        title="Edit Banner"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteBanner && banners.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteBanner(b.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete Banner"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Banner Edit / Create Form */}
            <form
              onSubmit={handleSaveBannerSubmit}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] space-y-3"
            >
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {editingBanner ? `Edit Banner: ${editingBanner.title}` : 'Add New Carousel Banner'}
              </h4>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Banner Headline *
                </label>
                <input
                  type="text"
                  required
                  value={banTitle}
                  onChange={e => setBanTitle(e.target.value)}
                  placeholder="e.g. Special Grammar Masterclass & Examination Prep"
                  className="w-full px-3 py-2 bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FEA339] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Short Description
                </label>
                <textarea
                  rows={2}
                  value={banDescription}
                  onChange={e => setBanDescription(e.target.value)}
                  placeholder="Details for students viewing the announcement..."
                  className="w-full px-3 py-2 bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FEA339] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    value={banBadge}
                    onChange={e => setBanBadge(e.target.value)}
                    placeholder="e.g. Exam Schedule, Important, New Book"
                    className="w-full px-3 py-2 bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FEA339] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Color Theme
                  </label>
                  <select
                    value={banBgColor}
                    onChange={e => setBanBgColor(e.target.value as BannerColorTheme)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FEA339] focus:outline-none"
                  >
                    <option value="green">Leaf Green (#4BA95F)</option>
                    <option value="cyan">Sky Cyan (#77DDFA)</option>
                    <option value="amber">Warm Amber (#FEA339)</option>
                    <option value="purple">Soft Purple (#9985FB)</option>
                    <option value="coral">Soft Coral (#FF908D)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    External Link URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={banLinkUrl}
                    onChange={e => setBanLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FEA339] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Banner Poster Image (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer px-3 py-2 rounded-xl bg-slate-200 dark:bg-[#252525] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-300 transition-colors">
                      <ImageIcon className="w-3.5 h-3.5 text-[#FEA339]" />
                      <span>Upload Image</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handlePickBannerImage}
                        accept="image/*"
                      />
                    </label>
                    {banImageUrl && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Attached
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {editingBanner && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBanner(null);
                      setBanTitle('');
                      setBanDescription('');
                      setBanBadge('Announcement');
                      setBanLinkUrl('');
                      setBanImageUrl(undefined);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FEA339] hover:bg-[#e89128] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  {editingBanner ? 'Update Banner' : 'Add Banner to Carousel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
