type AiImageToolData = {
  url?: string;
  caption?: string;
  alt?: string;
  prompt?: string;
  size?: string;
  aspectRatio?: string;
  resolution?: string;
};

type AiImageToolConfig = {
  endpoint?: string;
  size?: string;
  aspectRatio?: string;
  resolution?: string;
  showResolution?: boolean;
  showAspectRatio?: boolean;
  showSize?: boolean;
  readOnly?: boolean;
};

const AI_IMAGE_TIMEOUT_MS = 120_000;

export default class AiImageTool {
  private api: any;
  private data: AiImageToolData;
  private config: AiImageToolConfig;
  private wrapper?: HTMLDivElement;
  private promptInput?: HTMLTextAreaElement;
  private sizeSelect?: HTMLSelectElement;
  private aspectRatioSelect?: HTMLSelectElement;
  private resolutionSelect?: HTMLSelectElement;
  private imageEl?: HTMLImageElement;
  private statusEl?: HTMLParagraphElement;
  private generateButton?: HTMLButtonElement;

  static get toolbox() {
    return {
      title: 'AI Image',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 16 5-5 4 4 4-4 5 5"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>'
    };
  }

  constructor({ data, api, config }: { data: AiImageToolData; api: any; config?: AiImageToolConfig }) {
    this.api = api;
    this.data = data || {};
    this.config = config || {};
  }

  render(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-image-tool space-y-3';

    const promptLabel = document.createElement('label');
    promptLabel.textContent = 'Prompt';
    promptLabel.className = 'block text-xs text-muted-foreground';

    const promptInput = document.createElement('textarea');
    promptInput.rows = 3;
    promptInput.value = this.data.prompt || '';
    promptInput.placeholder = 'Describe the image to generate';
    promptInput.className = 'w-full rounded-md border border-border px-3 py-2 text-sm';
    if (this.config.readOnly) {
      promptInput.disabled = true;
    }

    const controls = document.createElement('div');
    controls.className = 'grid gap-2 sm:grid-cols-2';

    const sizeWrapper = document.createElement('div');
    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Image size';
    sizeLabel.className = 'block text-xs text-muted-foreground';
    const sizeSelect = document.createElement('select');
    sizeSelect.className = 'w-full rounded-md border border-border px-2 py-2 text-sm';
    ['1024x1024', '1792x1024', '1024x1792'].forEach((size) => {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = size;
      if ((this.data.size || this.config.size) === size) {
        option.selected = true;
      }
      sizeSelect.appendChild(option);
    });
    sizeWrapper.appendChild(sizeLabel);
    sizeWrapper.appendChild(sizeSelect);
    if (this.config.showSize === false) {
      sizeWrapper.classList.add('hidden');
    }
    if (this.config.readOnly) {
      sizeSelect.disabled = true;
    }

    const aspectWrapper = document.createElement('div');
    const aspectLabel = document.createElement('label');
    aspectLabel.textContent = 'Aspect ratio';
    aspectLabel.className = 'block text-xs text-muted-foreground';
    const aspectSelect = document.createElement('select');
    aspectSelect.className = 'w-full rounded-md border border-border px-2 py-2 text-sm';
    ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'].forEach((ratio) => {
      const option = document.createElement('option');
      option.value = ratio;
      option.textContent = ratio;
      if ((this.data.aspectRatio || this.config.aspectRatio) === ratio) {
        option.selected = true;
      }
      aspectSelect.appendChild(option);
    });
    aspectWrapper.appendChild(aspectLabel);
    aspectWrapper.appendChild(aspectSelect);
    if (!this.config.showAspectRatio) {
      aspectWrapper.classList.add('hidden');
    }
    if (this.config.readOnly) {
      aspectSelect.disabled = true;
    }

    const resolutionWrapper = document.createElement('div');
    const resolutionLabel = document.createElement('label');
    resolutionLabel.textContent = 'Resolution';
    resolutionLabel.className = 'block text-xs text-muted-foreground';
    const resolutionSelect = document.createElement('select');
    resolutionSelect.className = 'w-full rounded-md border border-border px-2 py-2 text-sm';
    ['1K', '2K', '4K'].forEach((resolution) => {
      const option = document.createElement('option');
      option.value = resolution;
      option.textContent = resolution;
      if ((this.data.resolution || this.config.resolution) === resolution) {
        option.selected = true;
      }
      resolutionSelect.appendChild(option);
    });
    resolutionWrapper.appendChild(resolutionLabel);
    resolutionWrapper.appendChild(resolutionSelect);
    if (!this.config.showResolution) {
      resolutionWrapper.classList.add('hidden');
    }
    if (this.config.readOnly) {
      resolutionSelect.disabled = true;
    }

    controls.appendChild(sizeWrapper);
    controls.appendChild(aspectWrapper);
    controls.appendChild(resolutionWrapper);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Generate Image';
    button.className = 'btn btn-outline';
    if (this.config.readOnly) {
      button.textContent = 'AI generation disabled';
      button.disabled = true;
    }

    const status = document.createElement('p');
    status.className = 'text-xs text-muted-foreground';
    if (this.config.readOnly) {
      status.textContent = 'AI image generation is disabled.';
    }

    const previewWrapper = document.createElement('div');
    previewWrapper.className = 'overflow-hidden rounded-md border border-border bg-muted';
    const image = document.createElement('img');
    image.className = 'h-full w-full object-cover';
    if (this.data.url) {
      image.src = this.data.url;
    } else {
      previewWrapper.classList.add('hidden');
    }
    previewWrapper.appendChild(image);

    button.addEventListener('click', async () => {
      if (this.config.readOnly) {
        status.textContent = 'AI image generation is disabled.';
        return;
      }
      const prompt = promptInput.value.trim();
      if (!prompt) {
        status.textContent = 'Add a prompt to generate an image.';
        return;
      }

      button.disabled = true;
      status.textContent = 'Generating… This can take 30–90 seconds.';
      promptInput.disabled = true;
      sizeSelect.disabled = true;
      aspectSelect.disabled = true;
      resolutionSelect.disabled = true;

      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), AI_IMAGE_TIMEOUT_MS);
        let response: Response;
        try {
          response = await fetch(this.config.endpoint || '/api/features/ai/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              size: sizeSelect.value,
              aspectRatio: aspectSelect.value,
              resolution: resolutionSelect.value
            }),
            signal: controller.signal
          });
        } finally {
          window.clearTimeout(timer);
        }

        if (!response.ok) {
          const responseClone = response.clone();
          const payload = await response.json().catch(async () => {
            const text = await responseClone.text().catch(() => '');
            return text ? { error: text } : {};
          });
          throw new Error(payload?.error || 'Failed to generate image');
        }

        const payload = await response.json();
        const media = payload?.media;
        if (!media?.url) {
          throw new Error('Image generation did not return a URL');
        }

        this.data = {
          ...this.data,
          url: media.url,
          caption: media.caption,
          alt: media.altText,
          prompt,
          size: sizeSelect.value,
          aspectRatio: aspectSelect.value,
          resolution: resolutionSelect.value
        };

        image.src = media.url;
        previewWrapper.classList.remove('hidden');
        status.textContent = 'Image generated.';
      } catch (error: any) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          status.textContent = 'AI image request timed out. Please try again.';
        } else {
          status.textContent = error?.message || 'Image generation failed.';
        }
      } finally {
        if (!this.config.readOnly) {
          promptInput.disabled = false;
          sizeSelect.disabled = Boolean(this.config.readOnly);
          aspectSelect.disabled = Boolean(this.config.readOnly);
          resolutionSelect.disabled = Boolean(this.config.readOnly);
        }
        button.disabled = false;
      }
    });

    wrapper.appendChild(promptLabel);
    wrapper.appendChild(promptInput);
    wrapper.appendChild(controls);
    wrapper.appendChild(button);
    wrapper.appendChild(status);
    wrapper.appendChild(previewWrapper);

    this.wrapper = wrapper;
    this.promptInput = promptInput;
    this.sizeSelect = sizeSelect;
    this.aspectRatioSelect = aspectSelect;
    this.resolutionSelect = resolutionSelect;
    this.imageEl = image;
    this.statusEl = status;
    this.generateButton = button;
    return wrapper;
  }

  save() {
    return this.data;
  }

  validate(savedData: AiImageToolData) {
    return Boolean(savedData?.url || savedData?.prompt);
  }
}
