// QMD Renderer for GitHub - Content Script (v1.0.5 - Navigation Fix & KaTeX)
(function () {
    'use strict';

    // Check if we're on a .qmd file page
    function isQmdFile() {
        const pathMatch = window.location.pathname.match(/\/blob\/[^/]+\/(.+\.qmd)$/i);
        return pathMatch !== null;
    }

    // Libraries (marked.js and highlight.js) are loaded via manifest.json

    // Extract raw content from GitHub (React UI uses a hidden textarea!)
    function extractRawContent() {
        console.log('QMD Renderer: Attempting to extract content...');

        // Method 1: NEW React UI - Hidden textarea with ID (MOST RELIABLE!)
        const textarea = document.getElementById('read-only-cursor-text-area');
        if (textarea && textarea.value && textarea.value.length > 50) {
            console.log(`QMD Renderer: ✅ Found ${textarea.value.length} chars in textarea`);
            return textarea.value;
        }

        // Method 2: Try visible React code lines
        const reactLines = document.querySelectorAll('.react-code-line-contents-no-virtualization');
        if (reactLines.length > 0) {
            console.log('QMD Renderer: Using React visible code lines');
            return Array.from(reactLines).map(line => line.textContent).join('\n');
        }

        // Method 3: Old GitHub UI
        const oldLines = document.querySelectorAll('.js-file-line');
        if (oldLines.length > 0) {
            console.log('QMD Renderer: Using old GitHub UI selector');
            return Array.from(oldLines).map(line => line.textContent).join('\n');
        }

        console.log('QMD Renderer: ⚠️ Could not find content in DOM');
        return null;
    }

    // Parse YAML frontmatter
    function parseYamlFrontmatter(content) {
        const yamlRegex = /^---\n([\s\S]*?)\n---\n/;
        const match = content.match(yamlRegex);

        if (match) {
            const yaml = match[1];
            const remaining = content.slice(match[0].length);

            // Simple YAML parser for title and basic fields
            const metadata = {};
            yaml.split('\n').forEach(line => {
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim();
                    const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
                    metadata[key] = value;
                }
            });

            return { metadata, content: remaining };
        }

        return { metadata: {}, content };
    }

    // Remove LaTeX commands that don't render well in HTML
    function cleanLatexCommands(content) {
        return content
            .replace(/\\newpage\s*/g, '')
            .replace(/\\pagebreak\s*/g, '')
            .replace(/\\clearpage\s*/g, '')
            .replace(/\\cleardoublepage\s*/g, '')
            .replace(/\\noindent\s*/g, '');
    }

    // Render the QMD content
    async function renderQmdContent(rawContent) {
        const { metadata, content } = parseYamlFrontmatter(rawContent);

        // Clean LaTeX commands before rendering
        let processedContent = cleanLatexCommands(content);

        // Protect Math (preserve $$...$$ and $...$ from markdown rendering)
        const mathBlocks = [];

        // 1. Display Math $$...$$
        processedContent = processedContent.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
            mathBlocks.push(match);
            return `%%%MATH${mathBlocks.length - 1}%%%`;
        });

        // 2. Inline Math $...$
        processedContent = processedContent.replace(/\$([^$\n]+?)\$/g, (match) => {
            mathBlocks.push(match);
            return `%%%MATH${mathBlocks.length - 1}%%%`;
        });

        // 3. LaTeX Environments (equation, align, etc.) - Wrap in $$ for KaTeX
        const envRegex = /\\begin\{((?:equation|align|gather|flalign|multline|alignat|split)\*?)\}([\s\S]*?)\\end\{\1\}/g;
        processedContent = processedContent.replace(envRegex, (match) => {
            // Wrap naked environments in $$ so KaTeX renders them as display math
            mathBlocks.push(`$$${match}$$`);
            return `%%%MATH${mathBlocks.length - 1}%%%`;
        });

        // 4. Quarto Callouts (:::{.callout-note} ... :::)
        const calloutRegex = /:::\{\.callout-([a-z]+)\}\s*\n(?:#\s+(.*)\n)?([\s\S]*?):::/g;
        processedContent = processedContent.replace(calloutRegex, (match, type, title, content) => {
            const icons = {
                note: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
                warning: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
                important: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
                tip: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/></svg>',
                caution: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>'
            };

            const displayTitle = title || type.charAt(0).toUpperCase() + type.slice(1);
            const icon = icons[type] || icons.note;

            return `<div class="qmd-callout qmd-callout-${type}">
                <div class="qmd-callout-header">
                    <span class="qmd-callout-icon">${icon}</span>
                    ${displayTitle}
                </div>
                <div class="qmd-callout-body">
                    ${content}
                </div>
            </div>`;
        });

        // Parse markdown using marked.js
        let htmlContent = marked.parse(processedContent, {
            gfm: true,
            breaks: true,
            highlight: function (code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {
                        console.error('Highlight error:', err);
                    }
                }
                return hljs.highlightAuto(code).value;
            }
        });

        // Restore Math
        htmlContent = htmlContent.replace(/%%%MATH(\d+)%%%/g, (match, index) => {
            return mathBlocks[index];
        });

        // Create rendered container
        const renderedDiv = document.createElement('div');
        renderedDiv.id = 'qmd-rendered-content';
        renderedDiv.className = 'qmd-rendered';

        // Add metadata section if exists
        let metadataHtml = '';
        if (Object.keys(metadata).length > 0) {
            metadataHtml = '<div class="qmd-metadata">';
            if (metadata.title) {
                metadataHtml += `<h1 class="qmd-title">${escapeHtml(metadata.title)}</h1>`;
            }
            if (metadata.author) {
                metadataHtml += `<p class="qmd-author">By ${escapeHtml(metadata.author)}</p>`;
            }
            if (metadata.date) {
                metadataHtml += `<p class="qmd-date">${escapeHtml(metadata.date)}</p>`;
            }
            metadataHtml += '</div>';
        }

        renderedDiv.innerHTML = metadataHtml + '<div class="qmd-content">' + htmlContent + '</div>';

        // Render Math using KaTeX
        if (typeof renderMathInElement === 'function') {
            try {
                renderMathInElement(renderedDiv, {
                    delimiters: [
                        { left: "$$", right: "$$", display: true },
                        { left: "$", right: "$", display: false }
                    ],
                    throwOnError: false,
                    strict: 'ignore',
                    trust: true
                });
            } catch (e) {
                console.error('KaTeX rendering error:', e);
            }
        }

        return renderedDiv;
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Create toggle button
    function createToggleButton() {
        const button = document.createElement('button');
        button.id = 'qmd-toggle-btn';
        button.className = 'qmd-toggle-button';
        button.innerHTML = `
      <svg class="qmd-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25V2.75C0 1.784.784 1 1.75 1ZM1.5 2.75v10.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Zm7.03 5.53-2.22 2.22a.749.749 0 0 1-1.275-.326.749 .749 0 0 1 .215-.734l1.97-1.97-1.97-1.97a.749.749 0 1 1 1.06-1.06l2.22 2.22a.749.749 0 0 1 0 1.06Zm1.44 3.47h3.25a.75.75 0 0 0 0-1.5h-3.25a.75.75 0 0 0 0 1.5Z"/>
      </svg>
      <span class="qmd-btn-text">Render QMD</span>
    `;

        return button;
    }

    // Find where to insert the button
    function findButtonContainer() {
        // New React UI - file actions area
        const reactActions = document.querySelector('.react-blob-header-edit-and-raw-actions');
        if (reactActions) {
            console.log('QMD Renderer: Found React UI button container');
            return reactActions;
        }

        // Fallback selectors
        const selectors = [
            '.BlobViewHeader-module__Box_3--Kvpex',
            '.Box-header .d-flex',
            '[data-testid="header-actions"]',
            '.file-header',
            '.Box-header',
        ];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container) {
                console.log(`QMD Renderer: Found button container: ${selector}`);
                return container;
            }
        }
        return null;
    }

    // Find the file content container
    function findFileContainer() {
        const selectors = [
            '.react-code-file-contents',
            '.emxHYP',
            '[data-hpc]',
            '.Box-body',
            '.file',
            'main',
        ];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container) {
                console.log(`QMD Renderer: Found file container: ${selector}`);
                return container;
            }
        }
        return null;
    }

    // Main initialization with retry logic
    async function init(retryCount = 0) {
        if (!isQmdFile()) return;

        console.log('QMD Renderer: Detected .qmd file');

        // Check if libraries are loaded
        if (typeof marked === 'undefined' || typeof hljs === 'undefined') {
            console.error('QMD Renderer: ❌ Required libraries not loaded');
            return;
        }

        // Wait for GitHub React to load content (with retries)
        const textarea = document.getElementById('read-only-cursor-text-area');
        if (!textarea || !textarea.value) {
            if (retryCount < 15) {
                console.log(`QMD Renderer: ⏳ Waiting for content... (${retryCount + 1}/15)`);
                setTimeout(() => init(retryCount + 1), 300);
                return;
            }
            console.error('QMD Renderer: ❌ Textarea not found after retries');
            return;
        }

        // Extract content
        const rawContent = extractRawContent();

        if (!rawContent) {
            console.error('QMD Renderer: ❌ Could not extract content');
            return;
        }

        console.log(`QMD Renderer: ✅ Extracted ${rawContent.length} characters`);

        // Find where to put the button
        const buttonContainer = findButtonContainer();
        if (!buttonContainer) {
            console.error('QMD Renderer: ❌ Could not find button container');
            return;
        }

        // Create and add toggle button
        const toggleButton = createToggleButton();
        buttonContainer.appendChild(toggleButton);

        // Check if content is already rendered (from navigation)
        const existingRendered = document.getElementById('qmd-rendered-content');
        let isRendered = existingRendered !== null;

        // Sync button state with actual DOM state
        if (isRendered) {
            toggleButton.querySelector('.qmd-btn-text').textContent = 'Show Raw';
            toggleButton.classList.add('active');
            const fileContainer = findFileContainer();
            if (fileContainer) {
                fileContainer.style.display = 'none';
            }
        }

        // Toggle functionality
        toggleButton.addEventListener('click', async function () {
            if (!isRendered) {
                // Show loading state
                toggleButton.classList.add('loading');
                toggleButton.querySelector('.qmd-btn-text').textContent = 'Rendering...';

                try {
                    // Render content
                    const renderedContent = await renderQmdContent(rawContent);

                    // Find content container and hide it
                    const fileContainer = findFileContainer();
                    if (fileContainer) {
                        fileContainer.style.display = 'none';
                        fileContainer.parentElement.insertBefore(renderedContent, fileContainer);
                    }

                    // Update button
                    toggleButton.querySelector('.qmd-btn-text').textContent = 'Show Raw';
                    toggleButton.classList.remove('loading');
                    toggleButton.classList.add('active');
                    isRendered = true;

                    // Highlight all code blocks
                    document.querySelectorAll('#qmd-rendered-content pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });

                    console.log('QMD Renderer: ✅ Content rendered successfully');
                } catch (error) {
                    console.error('QMD Renderer: ❌ Rendering failed', error);
                    toggleButton.classList.remove('loading');
                    toggleButton.querySelector('.qmd-btn-text').textContent = 'Render Failed';
                }
            } else {
                // Show raw content
                const renderedContent = document.getElementById('qmd-rendered-content');
                if (renderedContent) {
                    renderedContent.remove();
                }
                const fileContainer = findFileContainer();
                if (fileContainer) {
                    fileContainer.style.display = '';
                }

                // Update button
                toggleButton.querySelector('.qmd-btn-text').textContent = 'Render QMD';
                toggleButton.classList.remove('active');
                isRendered = false;
            }
        });

        console.log('QMD Renderer: ✅ Initialized successfully');
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Handle GitHub's dynamic navigation (pjax)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            // Clean up old button and rendered content
            const oldButton = document.getElementById('qmd-toggle-btn');
            if (oldButton) oldButton.remove();

            const oldRendered = document.getElementById('qmd-rendered-content');
            if (oldRendered) oldRendered.remove();

            // Restore any hidden file containers
            const fileContainer = findFileContainer();
            if (fileContainer && fileContainer.style.display === 'none') {
                fileContainer.style.display = '';
            }

            setTimeout(init, 1000);
        }
    }).observe(document, { subtree: true, childList: true });
})();
