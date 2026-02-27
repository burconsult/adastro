import React, { useEffect, useMemo, useRef, useId } from 'react';
import type EditorJS from '@editorjs/editorjs';
import type { EditorJSData } from '@/lib/editorjs/types';
import { normalizeEditorJsData } from '@/lib/editorjs';

interface EditorJSEditorProps {
  data: EditorJSData;
  onChange: (data: EditorJSData) => void;
  extraToolsLoaders?: Array<(data?: EditorJSData) => Promise<Record<string, any>> | Record<string, any>>;
}

const directVideoService = {
  regex: /(https?:\/\/[^\s]+\.(?:mp4|webm|ogg)(?:\?[^\s]*)?)/i,
  embedUrl: '<%= remote_id %>',
  html: "<video controls playsinline preload='metadata' style='width: 100%;'></video>",
  width: 640,
  height: 360,
  id: (groups: string[]) => groups[0]
};

const directAudioService = {
  regex: /(https?:\/\/[^\s]+\.(?:mp3|wav|ogg|m4a|aac)(?:\?[^\s]*)?)/i,
  embedUrl: '<%= remote_id %>',
  html: "<audio controls preload='metadata' style='width: 100%;'></audio>",
  width: 640,
  height: 80,
  id: (groups: string[]) => groups[0]
};

export const EditorJSEditor: React.FC<EditorJSEditorProps> = ({
  data,
  onChange,
  extraToolsLoaders
}) => {
  const reactId = useId();
  const holderId = useMemo(() => `editorjs-${reactId.replace(/[:]/g, '')}`, [reactId]);
  const editorRef = useRef<EditorJS | null>(null);
  const initializingRef = useRef(false);
  const lastBlocksRef = useRef<string>('');
  const latestDataRef = useRef<EditorJSData>(normalizeEditorJsData(data));
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    latestDataRef.current = normalizeEditorJsData(data);
  }, [data]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (editorRef.current || initializingRef.current) return;
    initializingRef.current = true;
    let cancelled = false;

    const initEditor = async () => {
      try {
        const [
          { default: EditorJSConstructor },
          { default: Header },
          { default: List },
          { default: Checklist },
          { default: Table },
          { default: LinkTool },
          { default: Marker },
          { default: InlineCode },
          { default: Quote },
          { default: ImageTool },
          { default: Delimiter },
          { default: Embed },
          { default: RawTool },
          { default: CodeTool }
        ] = await Promise.all([
          import('@editorjs/editorjs'),
          import('@editorjs/header'),
          import('@editorjs/list'),
          import('@editorjs/checklist'),
          import('@editorjs/table'),
          import('@editorjs/link'),
          import('@editorjs/marker'),
          import('@editorjs/inline-code'),
          import('@editorjs/quote'),
          import('@editorjs/image'),
          import('@editorjs/delimiter'),
          import('@editorjs/embed'),
          import('@editorjs/raw'),
          import('@editorjs/code')
        ]);

        if (cancelled) return;

        const embedServices = {
          youtube: true,
          vimeo: true,
          twitter: true,
          instagram: true,
          html5video: directVideoService,
          html5audio: directAudioService
        };

        const videoServices = {
          youtube: true,
          vimeo: true,
          html5video: directVideoService
        };

        const audioServices = {
          html5audio: directAudioService
        };

        const isDirectVideoUrl = (value: string) => directVideoService.regex.test(value);
        const isDirectAudioUrl = (value: string) => directAudioService.regex.test(value);
        const inferYoutubeEmbedUrl = (value: string): string | null => {
          try {
            const url = new URL(value);
            const host = url.hostname.replace(/^www\./, '');
            if (host === 'youtube.com' || host === 'm.youtube.com') {
              if (url.pathname.startsWith('/shorts/')) {
                const shortId = url.pathname.replace(/^\/shorts\//, '').split('/')[0];
                return shortId ? `https://www.youtube.com/embed/${shortId}` : null;
              }
              const videoId = url.searchParams.get('v');
              return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
            }
            if (host === 'youtu.be') {
              const videoId = url.pathname.replace(/^\/+/, '').split('/')[0];
              return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
            }
            return null;
          } catch {
            return null;
          }
        };
        const inferYoutubeVideoId = (value: string): string | null => {
          try {
            const url = new URL(value);
            const host = url.hostname.replace(/^www\./, '');
            if (host === 'youtube.com' || host === 'm.youtube.com') {
              if (url.pathname.startsWith('/shorts/')) {
                const shortId = url.pathname.replace(/^\/shorts\//, '').split('/')[0];
                if (shortId) return shortId;
              }
              const videoId = url.searchParams.get('v');
              return videoId || null;
            }
            if (host === 'youtu.be') {
              const videoId = url.pathname.replace(/^\/+/, '').split('/')[0];
              return videoId || null;
            }
            return null;
          } catch {
            return null;
          }
        };
        const inferVimeoEmbedUrl = (value: string): string | null => {
          try {
            const url = new URL(value);
            const host = url.hostname.replace(/^www\./, '');
            if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null;
            const match = url.pathname.match(/\/(\d+)(?:$|\/)/);
            return match?.[1] ? `https://player.vimeo.com/video/${match[1]}` : null;
          } catch {
            return null;
          }
        };
        const inferSoundCloudEmbedUrl = (value: string): string | null => {
          try {
            const url = new URL(value);
            const host = url.hostname.replace(/^www\./, '');
            if (!host.includes('soundcloud.com')) return null;
            return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}`;
          } catch {
            return null;
          }
        };
        const classifyMediaUrl = (kind: 'video' | 'audio', value: string) => {
          const source = value.trim();
          if (!source) return null;
          if (kind === 'video') {
            if (isDirectVideoUrl(source)) {
              return { source, embed: source, service: 'html5video', preview: 'video' as const, mimeType: '' };
            }
            const youtubeEmbed = inferYoutubeEmbedUrl(source);
            if (youtubeEmbed) return { source, embed: youtubeEmbed, service: 'youtube', preview: 'iframe' as const, mimeType: '' };
            const vimeoEmbed = inferVimeoEmbedUrl(source);
            if (vimeoEmbed) return { source, embed: vimeoEmbed, service: 'vimeo', preview: 'iframe' as const, mimeType: '' };
            return { source, embed: source, service: undefined, preview: 'iframe' as const, mimeType: '' };
          }
          if (isDirectAudioUrl(source)) {
            return { source, embed: source, service: 'html5audio', preview: 'audio' as const, mimeType: '' };
          }
          const soundcloudEmbed = inferSoundCloudEmbedUrl(source);
          if (soundcloudEmbed) return { source, embed: soundcloudEmbed, service: 'soundcloud', preview: 'iframe' as const, mimeType: '' };
          return { source, embed: source, service: undefined, preview: 'iframe' as const, mimeType: '' };
        };

        const createLibraryMediaTool = (kind: 'video' | 'audio') => {
          const toolboxTitle = kind === 'video' ? 'Video' : 'Audio';
          const toolboxIcon = kind === 'video'
            ? '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M8 5.5v13a.5.5 0 0 0 .8.4l9-6.5a.5.5 0 0 0 0-.8l-9-6.5a.5.5 0 0 0-.8.4Z" fill="currentColor"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M14 5v14l-4-3H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h4l4-3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M17 9.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19.5 7a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

          return class LibraryMediaTool {
            private data: any;
            private config: any;
            private wrapper?: HTMLDivElement;
            private urlInput?: HTMLInputElement;
            private captionInput?: HTMLInputElement;
            private statusEl?: HTMLParagraphElement;
            private previewEl?: HTMLDivElement;
            private librarySelect?: HTMLSelectElement;
            private applyUrlButton?: HTMLButtonElement;
            private loadingLibrary = false;
            private mediaLibraryAssets: Array<{ id: string; url: string; mimeType?: string; altText?: string; caption?: string }> = [];

            static get toolbox() {
              return { title: toolboxTitle, icon: toolboxIcon };
            }

            constructor({ data, config }: { data: any; config?: any }) {
              this.data = data || {};
              this.config = config || {};
            }

            private setStatus(message: string, tone: 'default' | 'error' = 'default') {
              if (!this.statusEl) return;
              this.statusEl.textContent = message;
              this.statusEl.className = tone === 'error'
                ? 'text-xs text-destructive'
                : 'text-xs text-muted-foreground';
            }

            private renderPreview() {
              if (!this.previewEl || !this.urlInput) return;
              this.previewEl.innerHTML = '';
              const classified = classifyMediaUrl(kind, this.urlInput.value);
              if (!classified) {
                this.previewEl.classList.add('hidden');
                return;
              }

              this.previewEl.classList.remove('hidden');

              if (classified.preview === 'video') {
                const video = document.createElement('video');
                video.controls = true;
                video.preload = 'metadata';
                video.playsInline = true;
                video.className = 'w-full max-h-60 rounded-md bg-black';
                video.src = classified.embed;
                this.previewEl.appendChild(video);
                return;
              }

              if (classified.preview === 'audio') {
                const audio = document.createElement('audio');
                audio.controls = true;
                audio.preload = 'metadata';
                audio.className = 'w-full';
                audio.src = classified.embed;
                this.previewEl.appendChild(audio);
                return;
              }

              const card = document.createElement('div');
              card.className = 'rounded-md border border-border/70 bg-background p-3 text-xs';

              if (kind === 'video' && classified.service === 'youtube') {
                const youtubeId = inferYoutubeVideoId(classified.source);
                if (youtubeId) {
                  const thumbWrap = document.createElement('div');
                  thumbWrap.className = 'mb-2 overflow-hidden rounded-md border border-border/60 bg-black/80';

                  const thumb = document.createElement('img');
                  thumb.src = `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`;
                  thumb.alt = 'YouTube video thumbnail preview';
                  thumb.loading = 'lazy';
                  thumb.decoding = 'async';
                  thumb.className = 'block aspect-video w-full object-cover';
                  thumb.referrerPolicy = 'no-referrer';

                  thumbWrap.appendChild(thumb);
                  card.appendChild(thumbWrap);
                }
              }

              const provider = document.createElement('p');
              provider.className = 'font-medium text-foreground';
              provider.textContent = classified.service
                ? `External ${kind} (${classified.service})`
                : `External ${kind}`;

              const note = document.createElement('p');
              note.className = 'mt-1 text-muted-foreground';
              note.textContent = 'Preview disabled in editor to avoid third-party embed console noise. It will render on the site.';

              const link = document.createElement('a');
              link.href = classified.source;
              link.target = '_blank';
              link.rel = 'noreferrer noopener';
              link.className = 'mt-2 block truncate text-primary underline';
              link.textContent = classified.source;

              card.appendChild(provider);
              card.appendChild(note);
              card.appendChild(link);
              this.previewEl.appendChild(card);
            }

            private syncDataFromInputs() {
              if (!this.urlInput || !this.captionInput) return;
              const url = this.urlInput.value.trim();
              const caption = this.captionInput.value.trim();
              const classified = classifyMediaUrl(kind, url);
              this.data = {
                ...this.data,
                caption,
                url,
                source: classified?.source || url,
                embed: classified?.embed || url,
                service: classified?.service,
                mimeType: this.data?.mimeType || undefined
              };
              this.renderPreview();
            }

            private async loadLibraryAssets() {
              if (this.loadingLibrary || !this.librarySelect) return;
              this.loadingLibrary = true;
              this.setStatus(`Loading ${kind} files from media library…`);
              this.librarySelect.disabled = true;
              try {
                const response = await fetch(`/api/admin/media?mimeType=${kind}&limit=40`);
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                  throw new Error(payload?.message || payload?.error || 'Failed to load media library');
                }

                const assets = Array.isArray(payload?.assets) ? payload.assets : [];
                this.mediaLibraryAssets = assets
                  .filter((asset: any) => typeof asset?.id === 'string' && typeof asset?.url === 'string')
                  .map((asset: any) => ({
                    id: asset.id,
                    url: asset.url,
                    mimeType: asset.mimeType,
                    altText: asset.altText,
                    caption: asset.caption
                  }));

                this.librarySelect.innerHTML = '';
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = this.mediaLibraryAssets.length > 0
                  ? `Choose a ${kind} file from your media library`
                  : `No ${kind} files found in media library`;
                this.librarySelect.appendChild(emptyOption);

                for (const asset of this.mediaLibraryAssets) {
                  const option = document.createElement('option');
                  option.value = asset.id;
                  const label = (asset.altText || asset.caption || asset.url).slice(0, 120);
                  option.textContent = label;
                  this.librarySelect.appendChild(option);
                }

                this.setStatus(
                  this.mediaLibraryAssets.length > 0
                    ? `Loaded ${this.mediaLibraryAssets.length} ${kind} file${this.mediaLibraryAssets.length === 1 ? '' : 's'} from the media library.`
                    : `No ${kind} files found in the media library. You can still paste a URL below.`
                );
              } catch (error) {
                this.setStatus(error instanceof Error ? error.message : 'Failed to load media library.', 'error');
              } finally {
                this.loadingLibrary = false;
                this.librarySelect.disabled = false;
              }
            }

            render() {
              const wrapper = document.createElement('div');
              wrapper.className = 'space-y-3';

              const help = document.createElement('p');
              help.className = 'text-xs text-muted-foreground';
              help.textContent = kind === 'video'
                ? 'Paste a YouTube/Vimeo URL or a direct video file URL, or choose a video from the media library.'
                : 'Paste a direct audio file URL (MP3/WAV/OGG/M4A) or a SoundCloud link, or choose an audio file from the media library.';

              const libraryRow = document.createElement('div');
              libraryRow.className = 'grid gap-2 sm:grid-cols-[1fr_auto_auto]';

              const librarySelect = document.createElement('select');
              librarySelect.className = 'w-full rounded-md border border-border px-2 py-2 text-sm';
              const libraryPlaceholder = document.createElement('option');
              libraryPlaceholder.value = '';
              libraryPlaceholder.textContent = `Load ${kind} files from media library`;
              librarySelect.appendChild(libraryPlaceholder);

              const loadButton = document.createElement('button');
              loadButton.type = 'button';
              loadButton.className = 'btn btn-outline';
              loadButton.textContent = 'Load files';

              const useButton = document.createElement('button');
              useButton.type = 'button';
              useButton.className = 'btn btn-outline';
              useButton.textContent = 'Use selected';

              libraryRow.appendChild(librarySelect);
              libraryRow.appendChild(loadButton);
              libraryRow.appendChild(useButton);

              const urlRow = document.createElement('div');
              urlRow.className = 'space-y-1';

              const urlLabel = document.createElement('label');
              urlLabel.className = 'block text-xs text-muted-foreground';
              urlLabel.textContent = 'Media URL';

              const urlInput = document.createElement('input');
              urlInput.type = 'url';
              urlInput.className = 'w-full rounded-md border border-border px-3 py-2 text-sm';
              urlInput.placeholder = kind === 'video'
                ? 'https://youtu.be/... or https://cdn.example.com/video.mp4'
                : 'https://cdn.example.com/audio.mp3 or https://soundcloud.com/...';
              urlInput.value = String(this.data?.source || this.data?.url || '');

              urlRow.appendChild(urlLabel);
              urlRow.appendChild(urlInput);

              const captionRow = document.createElement('div');
              captionRow.className = 'space-y-1';

              const captionLabel = document.createElement('label');
              captionLabel.className = 'block text-xs text-muted-foreground';
              captionLabel.textContent = 'Caption (optional)';

              const captionInput = document.createElement('input');
              captionInput.type = 'text';
              captionInput.className = 'w-full rounded-md border border-border px-3 py-2 text-sm';
              captionInput.value = String(this.data?.caption || '');
              captionInput.placeholder = kind === 'video' ? 'Video caption' : 'Audio caption';

              captionRow.appendChild(captionLabel);
              captionRow.appendChild(captionInput);

              const status = document.createElement('p');
              status.className = 'text-xs text-muted-foreground';
              status.textContent = 'Paste a URL or load a file from the media library.';

              const preview = document.createElement('div');
              preview.className = 'hidden overflow-hidden rounded-md border border-border/70 bg-muted/20 p-2';

              const updateFromLibrarySelection = () => {
                const selectedId = librarySelect.value;
                const asset = this.mediaLibraryAssets.find((item) => item.id === selectedId);
                if (!asset) {
                  this.setStatus(`Choose a ${kind} file from the list first.`);
                  return;
                }
                urlInput.value = asset.url;
                if (!captionInput.value.trim() && (asset.altText || asset.caption)) {
                  captionInput.value = asset.altText || asset.caption || '';
                }
                this.data = {
                  ...this.data,
                  mimeType: asset.mimeType || undefined,
                  id: asset.id
                };
                this.syncDataFromInputs();
                this.setStatus(`${toolboxTitle} file inserted from media library.`);
              };

              loadButton.addEventListener('click', () => {
                void this.loadLibraryAssets();
              });
              useButton.addEventListener('click', updateFromLibrarySelection);
              librarySelect.addEventListener('change', () => {
                if (!librarySelect.value) return;
                updateFromLibrarySelection();
              });

              urlInput.addEventListener('input', () => {
                // Live preview while typing/pasting, but avoid forcing Editor.js saves on every keystroke.
                this.data = { ...this.data, mimeType: undefined };
                this.renderPreview();
              });
              urlInput.addEventListener('change', () => {
                this.syncDataFromInputs();
              });
              urlInput.addEventListener('blur', () => {
                this.syncDataFromInputs();
              });
              captionInput.addEventListener('change', () => {
                this.syncDataFromInputs();
              });
              captionInput.addEventListener('blur', () => {
                this.syncDataFromInputs();
              });

              const readOnly = Boolean(this.config?.readOnly);
              if (readOnly) {
                [librarySelect, loadButton, useButton, urlInput, captionInput].forEach((el) => {
                  (el as any).disabled = true;
                });
              }

              wrapper.appendChild(help);
              wrapper.appendChild(libraryRow);
              wrapper.appendChild(urlRow);
              wrapper.appendChild(captionRow);
              wrapper.appendChild(status);
              wrapper.appendChild(preview);

              this.wrapper = wrapper;
              this.urlInput = urlInput;
              this.captionInput = captionInput;
              this.statusEl = status;
              this.previewEl = preview;
              this.librarySelect = librarySelect;
              this.applyUrlButton = useButton;

              this.syncDataFromInputs();
              return wrapper;
            }

            save() {
              this.syncDataFromInputs();
              const url = String(this.data?.source || this.data?.url || '').trim();
              if (!url) return {};
              const classified = classifyMediaUrl(kind, url);
              return {
                ...this.data,
                source: classified?.source || url,
                url,
                embed: classified?.embed || url,
                service: classified?.service,
                caption: typeof this.data?.caption === 'string' ? this.data.caption : '',
                ...(this.data?.mimeType ? { mimeType: this.data.mimeType } : {})
              };
            }

            validate(savedData: any) {
              // Allow an empty in-progress block while the editor UI is open.
              // The serializer drops empty media blocks on output.
              return true;
            }
          };
        };

        const VideoEmbedTool = createLibraryMediaTool('video');
        const AudioEmbedTool = createLibraryMediaTool('audio');

        const tools: Record<string, any> = {
          header: {
            class: Header,
            inlineToolbar: true,
            config: {
              levels: [2, 3, 4],
              defaultLevel: 2
            }
          },
          list: {
            class: List,
            inlineToolbar: true
          },
          checklist: {
            class: Checklist,
            inlineToolbar: true,
            toolbox: false
          },
          table: {
            class: Table,
            inlineToolbar: true,
            config: {
              rows: 3,
              cols: 3,
              withHeadings: true
            }
          },
          linkTool: {
            class: LinkTool,
            config: {
              endpoint: '/api/admin/link-preview'
            }
          },
          marker: {
            class: Marker
          },
          inlineCode: {
            class: InlineCode
          },
          quote: {
            class: Quote,
            inlineToolbar: true,
            config: {
              quotePlaceholder: 'Quote',
              captionPlaceholder: 'Author'
            }
          },
          image: {
            class: ImageTool,
            config: {
              uploader: {
                async uploadByFile(file: File) {
                  try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const response = await fetch('/api/admin/media/upload', {
                      method: 'POST',
                      body: formData
                    });
                    const payload = await response.json().catch(() => null);
                    if (!response.ok) {
                      return {
                        success: 0,
                        message: payload?.message || payload?.error || `Upload failed (${response.status})`
                      };
                    }
                    const asset = payload?.public || payload?.original;
                    const url = asset?.url || asset?.storagePath;
                    if (!asset || !url) {
                      return {
                        success: 0,
                        message: 'Upload completed but no media URL was returned.'
                      };
                    }
                    return {
                      success: 1,
                      file: {
                        url,
                        id: asset?.id,
                        name: asset?.filename
                      }
                    };
                  } catch (error) {
                    return {
                      success: 0,
                      message: error instanceof Error ? error.message : 'Upload failed.'
                    };
                  }
                }
              }
            }
          },
          delimiter: Delimiter,
          embed: {
            class: Embed,
            config: {
              services: embedServices
            },
            toolbox: false
          },
          video: {
            class: VideoEmbedTool,
            toolbox: {
              title: 'Video',
              icon: '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M8 5.5v13a.5.5 0 0 0 .8.4l9-6.5a.5.5 0 0 0 0-.8l-9-6.5a.5.5 0 0 0-.8.4Z" fill="currentColor"/></svg>'
            }
          },
          audio: {
            class: AudioEmbedTool,
            toolbox: {
              title: 'Audio',
              icon: '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M14 5v14l-4-3H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h4l4-3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M17 9.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19.5 7a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
            }
          },
          raw: RawTool,
          code: CodeTool
        };

        if (extraToolsLoaders && extraToolsLoaders.length > 0) {
          const extras = await Promise.all(
            extraToolsLoaders.map(async (loader) => {
              try {
                const result = await loader(latestDataRef.current);
                return result && typeof result === 'object' ? result : {};
              } catch (error) {
                console.warn('EditorJS tool loader failed', error);
                return {};
              }
            })
          );
          extras.forEach((extra) => {
            Object.assign(tools, extra);
          });
        }

        const editor = new EditorJSConstructor({
          holder: holderId,
          data: normalizeEditorJsData(latestDataRef.current),
          autofocus: true,
          placeholder: 'Start writing your post...',
          tools,
          async onChange() {
            if (!editorRef.current) return;
            try {
              const output = await editorRef.current.save();
              const normalizedOutput = normalizeEditorJsData(output as EditorJSData);
              lastBlocksRef.current = JSON.stringify(normalizedOutput.blocks ?? []);
              onChangeRef.current(normalizedOutput);
            } catch (error) {
              console.warn('EditorJS save failed', error);
            }
          }
        });

        editorRef.current = editor;
        editor.isReady
          .then(() => {
            if (editorRef.current === editor) {
              lastBlocksRef.current = JSON.stringify(normalizeEditorJsData(latestDataRef.current)?.blocks ?? []);
            }
          })
          .catch(() => undefined);
      } finally {
        initializingRef.current = false;
      }
    };

    void initEditor();

    return () => {
      cancelled = true;
      const editor = editorRef.current as EditorJS | null;
      if (editor && typeof (editor as { destroy?: unknown }).destroy === 'function') {
        editor.destroy();
      }
      editorRef.current = null;
      initializingRef.current = false;
    };
  }, [extraToolsLoaders]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const normalizedData = normalizeEditorJsData(data);
    const serializedBlocks = JSON.stringify(normalizedData?.blocks ?? []);
    if (!serializedBlocks || serializedBlocks === lastBlocksRef.current) {
      return;
    }
    let cancelled = false;
    const applyUpdate = async () => {
      try {
        await editor.isReady;
        if (cancelled || editorRef.current !== editor) return;
        if (typeof editor.render === 'function') {
          await editor.render(normalizedData);
          if (!cancelled && editorRef.current === editor) {
            lastBlocksRef.current = serializedBlocks;
          }
        }
      } catch (error) {
        console.warn('EditorJS render failed', error);
      }
    };

    void applyUpdate();
    return () => {
      cancelled = true;
    };
  }, [data]);

  return <div id={holderId} className="min-h-[480px]" />;
};

export default EditorJSEditor;
