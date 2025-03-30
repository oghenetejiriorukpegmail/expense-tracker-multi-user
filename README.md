# Expenses App - AI-Powered Receipt Tracker 

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A web application for tracking expenses with automated receipt scanning via AI OCR (Tesseract.js or AI providers).

## Features

✔ **Receipt Processing**
- Upload receipts (images/PDFs)
- Automatic extraction of:
  - Date
  - Amount
  - Vendor
  - Location
  - Expense type

✔ **Trip Classification**
- Organize expenses by trip name
- Export trip expenses to Excel (.xlsx)
- View grouped by trip

✔ **Multiple OCR Options**
- Built-in Tesseract.js (no API key needed)
- Support for AI providers:
  - OpenAI GPT Vision (Planned)
  - Google Gemini (Implemented)
  - Claude (Planned)
  - OpenRouter (Planned)

✔ **User Interface**
- Responsive mobile-friendly design
- Receipt thumbnails with zoom
- Instant notifications
- Grouped expense listing
- Improved API Key input fields

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/oghenetejiriorukpegmail/expenses-app.git
   cd expenses-app
   ```

2. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Run the server**:
   ```bash
   # From the backend directory
   npm start
   # Or: node server.js
   ```

4. **Access the app**:
   Open `http://localhost:3000` in your browser

## Configuration

Configure OCR settings via the Settings page (`/settings.html`):
- Choose OCR provider (Tesseract, Gemini, OpenAI, Claude, OpenRouter)
- Enter API keys for the desired AI providers.
- Select preferred models (where applicable).
- **Note:** Clicking "Save Settings" updates the API keys stored in the `backend/.env` file on the server. The server reads these keys for OCR processing. Ensure the server process has write permissions to `.env` if running in restricted environments. A server restart might be needed for changes to fully apply in all cases.

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express
- **OCR**:
  - Tesseract.js (default, via `utils/ocr.js`)
  - Google Gemini, OpenAI, Claude, OpenRouter (via `utils/ocr.js`)
- **API Key Storage**: `.env` file on the backend (managed via Settings UI -> `/api/update-env` endpoint)
- **Data Storage**: JSON file system (`backend/data.json`)
- **Excel Export**: SheetJS/xlsx
- **Testing**: Jest

## Future Roadmap

See [PLAN.md](PLAN.md) for detailed development roadmap including:
- Multi-user support
- Advanced analytics
- Cloud storage
- Mobile app version

## License

MIT License - see [LICENSE](LICENSE) file for details