# ChatTree

> **Navigate your AI conversations like a map, not a scroll.**  
> A Chromium extension that visualizes your chat session as an interactive tree — so you never lose track of where you were.

> _Please check [KOI README](./docs/README_KOI.md) (for KOI organizers)._

<br/>

![demo1-v0.2.0](./docs/demo-vids/demo1-v0.2.0.gif)

> Tree-map navigation

![demo2-v0.2.0](./docs/demo-vids/demo2-v0.2.0.gif)

> Hover to preview & Click to jump

![demo3-v0.2.0](./docs/demo-vids/demo3-v0.2.0.gif)

> Branch tracking

<br/>

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE) [![Manifest](https://img.shields.io/badge/Manifest-V3-green.svg)]() [![Platform](https://img.shields.io/badge/Platform-Chromium-yellow.svg)]() [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

## 1. Problem

AI chatbot sessions grow long and complex — especially when you edit previous prompts and create branching conversations. Finding a specific exchange requires endless scrolling, and there's no visual overview of where you are in the conversation.

**ChatTree solves this** by floating an interactive tree-map navigator directly inside your chat UI.

## 2. Features

### 2-1. Core

- 🗺️ **Tree-map navigator** — visualizes every chatbox as a node, floated over the chat UI
- 💬 **Hover to preview** — mouse over any node to see the original full prompt in a popup
- 🖱️ **Click to jump** — click any node to instantly scroll to that chatbox
- 🌿 **Branch tracking** — branch nodes are visually distinct, showing branch count per node
<!-- - 🔍 **AI-powered summaries** — each node shows a short AI-generated summary of the prompt -->

### 2-2. Customization (Options)

- 📐 Position: top-left / top-right / bottom-left / bottom-right
- 🔄 Layout: Top-down view / Left-right view
- 🌫️ Background opacity adjustment
- 🔃 Sort order: ascending / descending by latest node

## 3. Supported Platforms

| Platform           | Status       |
| ------------------ | ------------ |
| Claude (claude.ai) | ✅ Supported |
| ChatGPT            | 🔜 Planned   |
| Gemini             | 🔜 Planned   |

## 4. Getting Started

### 4-1.Prerequisites

- Chrome or any Chromium-based browser (Edge, Brave, Arc, etc.)
- Node.js >= 18

### 4-2. Installation (Development)

```bash
# 1. Clone the repository
git clone https://github.com/MintCat98/enhanced-navigation-for-ai-chatbots.git
cd enhanced-navigation-for-ai-chatbots

# 2. Install dependencies
npm install

# 3. Build the extension
npm run build

# 4. Load in Chrome
# Open chrome://extensions → Enable Developer Mode → Load Unpacked → Select /dist folder
```

### 4-3. Installation (Stable Release)

> _Chrome Web Store listing coming soon._

## 5. Architecture

```
src/
├── background/       # Service Worker (Manifest V3)
├── content/          # Content Script — DOM parsing & tree rendering
├── popup/            # Extension popup UI
├── options/          # Options page
└── shared/           # Shared utilities & types
```

## 6. Contributing

We welcome all contributions — bug reports, feature suggestions, and pull requests!  
Please read [CONTRIBUTING.md](.github/CONTRIBUTING.md) first.

## 7. Team

See [CONTRIBUTORS.md](.github/CONTRIBUTORS.md) for the full list.

## 8. License

This project is licensed under the **Apache License 2.0**.  
See [LICENSE](./LICENSE) for details.
