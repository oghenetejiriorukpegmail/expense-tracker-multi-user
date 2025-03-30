# Expense Tracker Application Plan

## 1. Project Goal

Create a mobile-friendly web application where users can:
*   Register and log in securely.
*   **Manage (create, view, delete) Trips on a dedicated page (`trips.html`).**
*   Upload a photo of a receipt and associate it with a Trip Name (`index.html`).
*   Have the application attempt to automatically fill the Date and Cost fields using OCR (Optical Character Recognition) on the uploaded receipt.
*   Extract expense details (Type, Date, Location, Trip Name, Cost, Comments).
*   View a list of *their own* expenses, grouped by Trip Name (`index.html`).
*   Export *their own* expenses for a specific trip to an Excel (.xlsx) file (`trips.html`).

## 2. Current Implementation Status

The application currently has the following functionality:
*   Frontend UI with:
    *   **Trip Management page (`trips.html`)**
    *   Expense entry/viewing page (`index.html`)
    *   Settings page (`settings.html`)
*   Multi-user support with registration and login.
*   Backend server with Express handling API endpoints for users, trips, and expenses.
*   File upload functionality for receipt images and PDFs.
*   OCR processing using Tesseract.js (built-in) or AI providers (Gemini, OpenAI, Claude, OpenRouter via `utils/ocr.js` module).
*   Settings page for configuring OCR method and API keys (requires login).
*   OCR testing functionality on the settings page.
*   Per-Trip Excel export functionality (Requires `tripName` query param, filename matches trip name, requires login).
*   **Data storage using an SQLite database (`backend/expenses.db`) with `users`, `trips`, and `expenses` tables.**
*   Expense editing and deletion (restricted to owner).
*   Trip creation and deletion (restricted to owner).
*   Enhanced UI with receipt thumbnails, modal view, loading indicators, toast notifications, expenses grouped by Trip Name.
*   Unit tests implemented for backend API endpoints using Jest.

## 3. Architecture

The application utilizes the following technology stack:

*   **Frontend:** HTML, CSS, and JavaScript (`script.js`, `settings.js`, `trips.js`). Provides the user interface, including login/registration, trip management, expense entry/viewing, and settings pages.
*   **Backend:** Node.js with the Express framework. Handles:
    *   User authentication (JWT, bcrypt).
    *   API endpoints for managing users, trips, and expenses.
    *   Storing data in an SQLite database.
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
        A --> Trips[Trips Page (trips.html)];
        Trips --> E;
        Trips -- Link --> B[Expense Form (index.html)];
        A --> Settings[Settings Page (settings.html)];
        Settings --> E;
        B --> C[Upload Receipt];
        C --> D{Submit Data};
        D --> E;
        E --> F[Display Expenses (index.html)];
        Trips --> G[Export Button]; // Export initiated from Trips page
        G --> E;
    end

    subgraph Server
        E --> H[Backend: Node.js/Express];
        H --> AuthAPI{Auth API (/api/auth/*)};
        AuthAPI --> O[Data Storage: SQLite DB];
        H --> TripAPI{Trip API (/api/trips/*)};
        TripAPI --> AuthMiddleware[Auth Middleware];
        TripAPI --> O;
        H --> ExpenseAPI{Expense API (/api/expenses/*)};
        ExpenseAPI --> AuthMiddleware;
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
    *   **(Done)** Implemented backend logic for AI providers.
    *   **(Done)** Implemented secure handling of API keys via secured endpoint.
    *   **(Optional) Implement dynamic fetching of available models.**

2.  **Export Functionality:**
    *   **(Done)** Fixed Excel export.
    *   **(Done)** Export endpoint requires `tripName` and authentication.
    *   **(Done)** Exported filename matches `tripName`.
    *   **(Done)** Frontend UI updated with per-trip export buttons (on `trips.html`) using authenticated JS fetch.

3.  **Security & Validation:**
    *   Address npm audit vulnerabilities.
    *   **(Done)** Implemented comprehensive input validation.
    *   **(Done)** Added sanitization for user inputs.
    *   **(Done)** Implemented user authentication and authorization.

4.  **Code Quality & Refactoring:**
    *   **(Done)** Refactored OCR logic.
    *   **(Done)** Added comments and improved readability.
    *   **(Done)** Fixed UI issues.
    *   **(Done)** Implemented backend unit tests.
    *   **(Done)** Migrated data storage from JSON to SQLite.
    *   **(Done)** Separated Trip Management into `trips.html` and `trips.js`.

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
  * **(Partially Done)** Improve code organization. Consider full MVC structure. **Consider creating shared JS utility file for auth/helpers.**
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
