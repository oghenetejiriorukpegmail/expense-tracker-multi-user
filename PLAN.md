# Expense Tracker Application Plan

## 1. Project Goal

Create a mobile-friendly web application where users can:
*   Register and log in securely.
*   Manually enter Trip Name.
*   Upload a photo of a receipt.
*   Have the application attempt to automatically fill the Date and Cost fields using OCR (Optical Character Recognition) on the uploaded receipt.
*   Extract expense details (Type, Date, Location, Trip Name, Cost, Comments).
*   View a list of *their own* expenses, grouped by Trip Name.
*   Export *their own* expenses for a specific trip to an Excel (.xlsx) file named after the trip.

## 2. Current Implementation Status

The application currently has the following functionality:
*   Basic frontend UI with a form for expense entry and a simple list display.
*   **Multi-user support with registration and login.**
*   Backend server with Express handling API endpoints.
*   File upload functionality for receipt images and PDFs.
*   OCR processing using Tesseract.js (built-in) or AI providers (Gemini, OpenAI, Claude, OpenRouter via `utils/ocr.js` module).
*   Settings page (`settings.html`) for configuring OCR method and API keys (requires login).
*   OCR testing functionality on the settings page.
*   Per-Trip Excel export functionality (Requires `tripName` query param, filename matches trip name, requires login).
*   **Data storage using an SQLite database (`backend/expenses.db`) with separate `users` and `expenses` tables.**
*   Expense editing and deletion (includes `tripName`, restricted to owner).
*   Enhanced UI with receipt thumbnails, modal view, loading indicators, toast notifications, expenses grouped by Trip Name, and per-trip export buttons.
*   Unit tests implemented for backend API endpoints using Jest.

## 3. Architecture

The application utilizes the following technology stack:

*   **Frontend:** HTML, CSS, and JavaScript. Provides the user interface, including login/registration and settings pages.
*   **Backend:** Node.js with the Express framework. Handles:
    *   Receiving expense data and uploaded receipts.
    *   **User authentication (JWT, bcrypt).**
    *   Storing user and expense data in an SQLite database.
    *   Storing uploaded images in an `uploads` directory.
    *   Performing OCR via `utils/ocr.js`.
    *   Generating per-trip Excel export files using `xlsx`.
*   **Database:** SQLite (`backend/expenses.db`).
*   **Authentication:** JWT (`jsonwebtoken`) for session management, `bcrypt` for password hashing.
*   **OCR:** Logic encapsulated in `backend/utils/ocr.js`. Supports Tesseract.js and AI providers.
*   **API Key Management:** Keys for AI OCR providers are stored in `backend/.env` (managed via the Settings UI -> `/api/update-env` endpoint, requires login).
*   **Excel Generation:** `xlsx` library creates .xlsx files for per-trip export.
*   **Testing:** Jest for backend unit testing.

## 4. High-Level Flow Diagram

```mermaid
graph TD
    subgraph User Device (Browser)
        A[Frontend: HTML/CSS/JS] --> Auth{Login/Register Forms};
        Auth --> E[Backend API];
        A --> Settings[Settings Page];
        Settings --> E;
        A --> B{Expense Form};
        B --> C[Upload Receipt];
        C --> D{Submit Data};
        D --> E;
        E --> F[Display Expenses];
        F --> G[Export Button];
        G --> E;
    end

    subgraph Server
        E --> H[Backend: Node.js/Express];
        H --> AuthAPI{Auth API (/api/auth/*)};
        AuthAPI --> O[Data Storage: SQLite DB];
        H --> ExpenseAPI{Expense API (/api/expenses/*)};
        ExpenseAPI --> AuthMiddleware[Auth Middleware];
        AuthMiddleware --> O;
        AuthMiddleware --> ExpenseAPIAction[CRUD/Export Logic];
        ExpenseAPIAction --> I[Handle Image Upload];
        I --> J[Store Image];
        ExpenseAPIAction --> K[OCR Service/Library];
        K --> L[Extract Text];
        L --> M[Parse Data];
        ExpenseAPIAction --> N[Store Expense Data];
        N --> O;
        ExpenseAPIAction --> P[Generate Export];
        P --> Q[Excel Library];
        O --> P;
        J --> K;
        M --> ExpenseAPIAction;
    end

    E --> A;

    style User Device fill:#f9f,stroke:#333,stroke-width:2px;
    style Server fill:#ccf,stroke:#333,stroke-width:2px;
```

## 5. Immediate Improvements (Current Sprint)
1.  **AI OCR Implementation:**
    *   **(Done)** Implemented backend logic for Gemini, OpenAI, Claude, and OpenRouter via `utils/ocr.js`.
    *   **(Done)** Implemented secure handling of API keys using a backend `.env` file, updated via a *secured* `/api/update-env` endpoint.
    *   **(Optional) Implement dynamic fetching of available models.**

2.  **Export Functionality:**
    *   **(Done)** Fixed Excel export to generate a proper .xlsx file.
    *   **(Done)** Export endpoint (`/api/export-expenses`) requires `tripName` and authentication.
    *   **(Done)** Exported filename matches `tripName`.
    *   **(Done)** Frontend UI updated with per-trip export buttons using authenticated JS fetch.

3.  **Security & Validation:**
    *   Address npm audit vulnerabilities.
    *   **(Done)** Implemented comprehensive input validation (frontend/backend).
    *   **(Done)** Added sanitization for user inputs.
    *   **(Done)** Implemented user authentication and authorization (JWT, bcrypt).

4.  **Code Quality & Refactoring:**
    *   **(Done)** Refactored OCR logic into `utils/ocr.js`.
    *   **(Done)** Added comments and improved readability.
    *   **(Done)** Fixed UI issues.
    *   **(Done)** Implemented backend unit tests.
    *   **(Done)** Migrated data storage from JSON to SQLite.

## 6. Future Development Roadmap

### Phase 1: Core Functionality Enhancements (1-2 weeks)
* **Categories & Tags:**
  * Add expense categorization
  * Implement tagging system
  * Add category-based filtering/sorting
* **Bulk Operations:**
  * Implement multi-select for expenses
  * Add bulk delete/categorization
  * Enable bulk export
* **Search & Filter:**
  * Add search functionality
  * Implement advanced filtering (date range, cost range, etc.)
  * Add sorting options

### Phase 2: Data Visualization & Insights (2-3 weeks)
* **Dashboard:**
  * Create spending summaries dashboard
  * Implement charts (spending by category, trends)
* **Reports:**
  * Generate monthly/quarterly reports
  * Add customizable parameters
  * Implement PDF export
* **Budget Tracking:**
  * Add budget setting
  * Implement budget vs. actual comparisons
  * Add budget overrun alerts

### Phase 3: Advanced Features & Infrastructure (3-4 weeks)
* **User Accounts & Authentication:**
  * **(Done)** User registration and login implemented.
  * Add password reset functionality.
  * Implement role-based access control (if needed).
* **Database Migration:**
  * **(Done)** Migrated from JSON to SQLite.
  * Consider migration to PostgreSQL/MongoDB for larger scale.
  * Implement database backup/restore.
* **Cloud Storage:**
  * Implement cloud storage for receipts (e.g., S3).
  * Add image compression.
  * Implement secure access.
* **Deployment & CI/CD:**
  * Set up CI/CD pipeline.
  * Implement environment configurations.
  * Add automated testing.

### Phase 4: Mobile & Integration (4+ weeks)
* **Progressive Web App:**
  * Implement offline functionality.
  * Add installable PWA features.
  * Implement push notifications.
* **Native Mobile App:**
  * Develop React Native/Flutter app.
  * Add camera integration.
  * Implement biometric authentication.
* **Third-party Integrations:**
  * Integrate with accounting software.
  * Implement bank statement import.
  * Add email forwarding for receipts.

## 7. Technical Debt & Maintenance

* **Code Refactoring:**
  * **(Partially Done)** Improve code organization. Consider full MVC structure.
  * **(Partially Done)** Implement consistent error handling.
  * **(Partially Done)** Add comprehensive logging.
  * **Address known vulnerabilities:** Monitor `xlsx` vulnerability or migrate.
* **Testing:**
  * **(Done)** Added backend unit tests.
  * Implement integration tests.
  * Add end-to-end tests.
* **Documentation:**
  * Create API documentation.
  * **(Done)** Added code comments (JSDoc).
  * Create user guide.
* **Performance Optimization:**
  * Optimize image processing.
  * Implement caching.
  * Improve load time.
