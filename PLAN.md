# Expense Tracker Application Plan

## 1. Project Goal

Create a mobile-friendly web application where users can:
*   Manually enter expense details (Type, Date, Location, **Trip Name**, Cost, Comments).
*   Upload a photo of a receipt.
*   Have the application attempt to automatically fill the Date and Cost fields using OCR (Optical Character Recognition) on the uploaded receipt.
*   View a list of their expenses, **grouped by Trip Name**.
*   **Export expenses for a specific trip** to an Excel (.xlsx) file named after the trip.

## 2. Current Implementation Status

The application currently has the following functionality:
* Basic frontend UI with a form for expense entry and a simple list display
* Backend server with Express handling API endpoints
* File upload functionality for receipt images and PDFs
* **OCR processing using Tesseract.js (built-in) or simulated AI providers (OpenAI, Gemini, Claude, Open Router)**
* **Settings page (`settings.html`) for configuring OCR method and API keys**
* **OCR testing functionality on the settings page**
* **Per-Trip Excel export functionality** (Requires `tripName` query param, filename matches trip name, Trip Name column removed from export data). **Global export removed.**
* Data storage using a JSON file (now includes `tripName`)
* Expense editing and deletion (includes `tripName`)
* Enhanced UI with receipt thumbnails, modal view, loading indicators, toast notifications, **expenses grouped by Trip Name, and per-trip export buttons.**

## 3. Architecture

The application utilizes the following technology stack:

*   **Frontend:** HTML, CSS, and JavaScript. This runs in the user's browser and provides the user interface, including a settings page.
*   **Backend:** Node.js with the Express framework. This server-side component handles:
    *   Receiving expense data (including Trip Name) and uploaded receipt images/PDFs.
    *   Storing expense data (including Trip Name) in a JSON file.
    *   Storing uploaded images in an uploads directory.
    *   **Performing OCR on images and PDFs using either Tesseract.js or simulating AI provider calls based on user settings.**
    *   **Generating per-trip Excel export files** (requires `tripName` query param, filename matches trip) using the xlsx library.
*   **OCR:** Tesseract.js is used for built-in OCR. **Simulated calls to external AI APIs (OpenAI, Gemini, Claude, Open Router) are implemented for testing, requiring user-provided API keys.**
*   **Excel Generation:** The xlsx library creates the .xlsx file for **per-trip export**.
*   **Data Storage:** A simple JSON file is used for data persistence (includes `tripName`).

## 4. High-Level Flow Diagram

```mermaid
graph TD
    subgraph User Device (Browser)
        A[Frontend: HTML/CSS/JS] --> B{Expense Form};
        A --> Settings[Settings Page];
        Settings --> E[Backend API];
        B --> C[Upload Receipt];
        C --> D{Submit Data};
        D --> E[Backend API];
        E --> F[Display Expenses];
        G[Export Button] --> E;
    end

    subgraph Server
        E --> H[Backend: Node.js/Express];
        H --> I[Handle Image Upload];
        I --> J[Store Image];
        H --> K[OCR Service/Library/AI Sim];
        K --> L[Extract Text];
        L --> M[Parse Data];
        H --> N[Store Expense Data];
        N --> O[Data Storage: JSON File/DB];
        H --> P[Generate Export];
        P --> Q[Excel/CSV Library];
        O --> P;
        J --> K;
        M --> H;
    end

    E --> A;
    E --> G;

    style User Device fill:#f9f,stroke:#333,stroke-width:2px;
    style Server fill:#ccf,stroke:#333,stroke-width:2px;
```

## 5. Immediate Improvements (Current Sprint)

1.  **AI OCR Implementation:**
    *   Replace AI provider simulations with actual API calls (OpenAI, Gemini, Claude, Open Router).
    *   Implement secure handling of API keys on the backend (e.g., using environment variables or a secure configuration store instead of passing from frontend).
    *   **(Optional) Implement dynamic fetching of available models for each AI provider.**

2.  **Export Functionality:**
    *   **(Done) Fix Excel export to generate a proper .xlsx file.**
    *   **(Done) Export endpoint (`/api/export-expenses`) now requires a `tripName` query parameter.**
    *   **(Done) Exported filename now matches the provided `tripName`.**
    *   **(Done) Frontend UI updated with per-trip export buttons.**

3.  **Security & Validation:**
    *   Address npm audit vulnerabilities.
    *   Implement comprehensive input validation on both frontend and backend.
    *   Add sanitization for user inputs.

4.  **Code Quality & Refactoring:**
    *   Refactor OCR processing logic on the backend for better organization.
    *   Add comments and improve code readability.

## 6. Future Development Roadmap

### Phase 1: Core Functionality Enhancements (1-2 weeks)
* **Categories & Tags:**
  * Add expense categorization (e.g., Food, Transport, Utilities)
  * Implement tagging system for better organization
  * Add category-based filtering and sorting

* **Bulk Operations:**
  * Implement multi-select functionality for expenses
  * Add bulk delete and bulk categorization features
  * Enable bulk export of selected expenses

* **Search & Filter:**
  * Add search functionality by any field
  * Implement advanced filtering (date range, cost range, etc.)
  * Add sorting options (newest/oldest, highest/lowest cost)

### Phase 2: Data Visualization & Insights (2-3 weeks)
* **Dashboard:**
  * Create a dashboard with spending summaries
  * Implement charts showing spending by category
  * Add time-based spending trends

* **Reports:**
  * Generate monthly/quarterly expense reports
  * Add customizable report parameters
  * Implement PDF export for reports

* **Budget Tracking:**
  * Add budget setting functionality
  * Implement budget vs. actual spending comparisons
  * Add alerts for budget overruns

### Phase 3: Advanced Features & Infrastructure (3-4 weeks)
* **User Accounts & Authentication:**
  * Implement user registration and login
  * Add password reset functionality
  * Implement role-based access control

* **Database Migration:**
  * Move from JSON file to a proper database (MongoDB or PostgreSQL)
  * Implement data migration strategy
  * Add database backup and restore functionality

* **Cloud Storage:**
  * Implement cloud storage for receipt images
  * Add image compression to save storage space
  * Implement secure access to stored images

* **Deployment & CI/CD:**
  * Set up continuous integration/deployment pipeline
  * Implement environment-specific configurations
  * Add automated testing

### Phase 4: Mobile & Integration (4+ weeks)
* **Progressive Web App:**
  * Make the application work offline
  * Add installable PWA functionality
  * Implement push notifications

* **Native Mobile App:**
  * Develop React Native or Flutter mobile app
  * Add camera integration for direct receipt capture
  * Implement biometric authentication

* **Third-party Integrations:**
  * Add integration with accounting software
  * Implement bank statement import
  * Add email forwarding for receipt processing

## 7. Technical Debt & Maintenance

* **Code Refactoring:**
  * Improve code organization with proper MVC structure
  * Implement consistent error handling
  * Add comprehensive logging

* **Testing:**
  * Add unit tests for backend functions
  * Implement integration tests for API endpoints
  * Add end-to-end testing for critical user flows

* **Documentation:**
  * Create API documentation
  * Add code comments and documentation
  * Create user guide and help documentation

* **Performance Optimization:**
  * Optimize image processing
  * Implement caching strategies
  * Improve application load time