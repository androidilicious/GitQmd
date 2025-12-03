// QMD Renderer for GitHub - Content Script (v1.0.5 - Navigation Fix)
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
        processedContent = processedContent.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
            mathBlocks.push(match);
            return `%%%MATH${mathBlocks.length - 1}%%%`;
        });
        processedContent = processedContent.replace(/\$([^$\n]+?)\$/g, (match) => {
            mathBlocks.push(match);
            return `%%%MATH${mathBlocks.length - 1}%%%`;
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
                    throwOnError: false
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
