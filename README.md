# Storybook Editor

A desktop book editor application built with Electron that provides AI-powered features for story consistency tracking, plot hole detection, grammar checking, and writing guidance.

## Features

- **Dual-Mode Editor**: Toggle between WYSIWYG and Markdown editing modes
- **LLM Integration**: Support for OpenAI, Anthropic (Claude), and Ollama (local models)
- **Story Element Tracking**: Automatically extract and track characters, locations, dates, and themes
- **Consistency Checking**: Detect inconsistencies in character names, ages, timelines, and locations
- **Plot Hole Detection**: Identify unresolved plot threads, timeline gaps, and logical issues
- **Grammar & Style Checking**: Real-time grammar and style suggestions
- **Writing Assistance**: Get suggestions for character development, pacing, dialogue, and scene transitions
- **Export**: Export your manuscript to DOCX, PDF, or HTML formats

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the application in development mode:

```bash
npm run dev
```

This will start both the Electron main process and the React renderer with hot reloading.

### Building

Build the application:

```bash
npm run build
```

### Packaging

Package the application for distribution:

```bash
# For macOS
npm run package:mac

# For Windows
npm run package:win

# For Linux
npm run package:linux
```

## Configuration

### LLM Providers

1. Open the Settings dialog from the toolbar
2. Navigate to the "LLM Providers" tab
3. Configure your API keys:
   - **OpenAI**: Enter your OpenAI API key and select a model (GPT-3.5 Turbo, GPT-4, etc.)
   - **Anthropic**: Enter your Anthropic API key and select a Claude model
   - **Ollama**: Configure the base URL (default: http://localhost:11434) and model name

4. Select your active provider from the dropdown

## Usage

### Creating a New Project

1. Click "New" in the toolbar
2. Start writing in either WYSIWYG or Markdown mode
3. Use the toggle button to switch between modes

### Saving and Loading

- **Save**: Click "Save" to save your project (you'll be prompted for a location on first save)
- **Open**: Click "Open" to load an existing project file (.sbk format)

### Story Elements

The sidebar automatically extracts story elements as you write:
- **Characters**: Names, ages, descriptions
- **Locations**: Places mentioned in your story
- **Dates**: Timeline events
- **Themes**: Recurring themes and motifs

### Consistency Checking

The "Issues" tab in the sidebar shows:
- Character inconsistencies
- Timeline conflicts
- Location name variations
- Theme inconsistencies

### Plot Analysis

The "Plot" tab shows detected plot holes:
- Unresolved plot threads
- Character motivation issues
- Timeline gaps
- Missing explanations

### Exporting

1. Click "Export" in the toolbar
2. Choose your format (DOCX or PDF)
3. The file will be downloaded to your default download location

## Project Structure

```
storybook/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # Main entry point
│   │   ├── window.ts      # Window management
│   │   ├── preload.ts     # Preload script
│   │   └── file-handler.ts # File operations
│   ├── renderer/          # React frontend
│   │   ├── components/    # React components
│   │   ├── stores/        # Zustand state management
│   │   ├── services/      # LLM and export services
│   │   └── hooks/         # Custom React hooks
│   └── shared/            # Shared types and utilities
├── package.json
└── webpack.*.config.js    # Webpack configurations
```

## Technologies Used

- **Electron**: Desktop application framework
- **React**: UI library
- **TypeScript**: Type-safe JavaScript
- **TipTap**: WYSIWYG editor
- **CodeMirror**: Markdown editor
- **Zustand**: State management
- **docx**: DOCX export
- **marked**: Markdown parsing

## License

MIT

