# Expense Tracker Application Plan

## 1. Project Goal

Create a mobile-friendly web application where users can:
*   Manually enter expense details (Type, Date, Location, Cost, Comments).
*   Upload a photo of a receipt.
*   Have the application attempt to automatically fill the Date and Cost fields using OCR (Optical Character Recognition) on the uploaded receipt.
*   View a list of their expenses.
*   Export all expenses to an Excel (.xlsx) file.

## 2. Proposed Architecture

The application will utilize the following technology stack:

*   **Frontend:** HTML, CSS, and JavaScript. This will run in the user's browser (optimized for mobile) and provide the user interface. Responsiveness is key.
*   **Backend:** Node.js with the Express framework. This server-side component will handle:
    *   Receiving expense data and uploaded receipt images.
    *   Storing expense data (initially in a JSON file).
    *   Storing uploaded images.
    *   Performing OCR on images.
    *   Generating the Excel export file.
*   **OCR:** A suitable Node.js library (potentially a wrapper around Tesseract OCR) will be used on the backend to extract text from receipt images.
*   **Excel Generation:** A Node.js library like `xlsx` will be used on the backend to create the `.xlsx` file.
*   **Data Storage:** A simple JSON file will be used for initial data persistence, with the possibility of upgrading to a database later if needed.

## 3. High-Level Flow Diagram

```mermaid
graph TD
    subgraph User Device (Android Phone Browser)
        A[Frontend: HTML/CSS/JS] --> B{Expense Form};
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
        H --> K[OCR Service/Library];
        K --> L[Extract Text];
        L --> M[Parse Date/Amount];
        H --> N[Store Expense Data];
        N --> O[Data Storage: JSON File/DB];
        H --> P[Generate Excel];
        P --> Q[Excel Library];
        O --> P;
        J --> K;
        M --> H;
    end

    E --> A;
    E --> G;

    style User Device fill:#f9f,stroke:#333,stroke-width:2px;
    style Server fill:#ccf,stroke:#333,stroke-width:2px;
```

## 4. Development Steps (Initial Implementation)

1.  **Create GitHub Repository:** Set up the `expenses-app` repository (Completed).
2.  **Basic Project Structure:** Create `frontend` and `backend` folders. Initialize the Node.js project in the `backend` directory (Completed).
3.  **Backend Server Setup:** Implement a basic Express server with API endpoints for:
    *   `POST /api/expenses` (Add new expense with optional image)
    *   `GET /api/expenses` (Retrieve all expenses)
    *   `GET /api/expenses/export` (Generate and download Excel file) (Completed).
4.  **Frontend UI:** Build the HTML form for expense entry and a section to display the expense list. Style using CSS for mobile responsiveness (Completed).
5.  **Frontend Interaction:** Write JavaScript to:
    *   Handle form submission, sending data (including the image file) to the backend `POST` endpoint.
    *   Fetch the expense list from the `GET` endpoint and display it.
    *   Trigger the Excel download from the `GET /export` endpoint (Completed).
6.  **Backend Storage & Image Handling:**
    *   Implement logic in the `POST /api/expenses` endpoint to save expense details to a `data.json` file.
    *   Handle file uploads (e.g., using `multer`) and save images to an `uploads` directory on the server. Store the image path with the expense data (Completed).
7.  **Backend OCR Integration:**
    *   Integrate an OCR library (like `tesseract.js` or similar).
    *   Modify the `POST /api/expenses` endpoint: if an image is uploaded, run OCR on it.
    *   Attempt to parse the extracted text to find potential Date and Cost values.
    *   *Initial thought:* Send suggestions back. *Revised approach for simplicity:* Directly save extracted data if found, or save manually entered data otherwise. User can edit later if needed (Completed).
8.  **Frontend OCR Handling:** (Simplified based on revised backend approach) Ensure the form correctly sends manual data and the image. The backend handles the OCR attempt during saving (Completed).
9.  **Backend Excel Export:** Implement the `GET /api/expenses/export` endpoint. Read data from `data.json`, format it using the `xlsx` library, and send the file back to the client for download (Completed).
10. **Refinement:** Add input validation (frontend and backend), error handling (e.g., failed OCR, file issues), and general UI/UX improvements (Partially done, further refinement needed).

---

## 5. Future Development Plan: Enhancements

This section outlines potential future improvements beyond the initial implementation.

**Phase 1: Core Functionality & Robustness**

1.  **Improve OCR Accuracy & Parsing:**
    *   **Goal:** Make the automatic extraction of date and cost more reliable.
    *   **Tasks:**
        *   Research and potentially integrate more advanced OCR pre-processing techniques (e.g., image deskewing, noise reduction).
        *   Refine the regex patterns in `findDateInText` and `findCostInText` to handle more date formats and edge cases (e.g., different currency symbols, amounts without decimals).
        *   Consider adding confidence scores from the OCR results to decide whether to use the extracted value.
        *   Allow users to easily correct OCR suggestions on the frontend before submitting.
2.  **Implement Expense Editing & Deletion:**
    *   **Goal:** Allow users to modify or remove existing expense entries.
    *   **Tasks:**
        *   **Backend:** Add `PUT /api/expenses/:id` and `DELETE /api/expenses/:id` endpoints. Update `server.js` to handle finding, updating, or removing expenses from `data.json`.
        *   **Frontend:** Add "Edit" and "Delete" buttons next to each expense in the list (`script.js`). Implement logic to either pre-fill the form for editing or send a DELETE request upon confirmation.
3.  **Address Security Vulnerabilities:**
    *   **Goal:** Resolve the reported `npm audit` vulnerability.
    *   **Tasks:**
        *   Run `npm audit` in the `backend` directory to understand the high-severity vulnerability.
        *   Attempt `npm audit fix`. If that doesn't work or breaks things, investigate the specific package and consider updating it manually or finding an alternative.
4.  **Add Input Validation:**
    *   **Goal:** Ensure data integrity and prevent errors.
    *   **Tasks:**
        *   **Frontend:** Add more robust client-side validation in `script.js` (e.g., check date ranges, ensure cost is positive).
        *   **Backend:** Enhance server-side validation in `server.js` for all fields before saving to `data.json`.

**Phase 2: User Experience (UI/UX)**

1.  **Improve Expense Display:**
    *   **Goal:** Make the expense list more informative and user-friendly.
    *   **Tasks:**
        *   Display the uploaded receipt image as a thumbnail next to the expense entry (`script.js`, `style.css`).
        *   Format dates and costs consistently.
        *   Consider adding sorting or filtering options (e.g., by date, type).
2.  **Enhance Mobile Responsiveness:**
    *   **Goal:** Ensure the application looks and works perfectly on various phone screen sizes.
    *   **Tasks:**
        *   Thoroughly test the UI on different mobile browsers/emulators.
        *   Refine `style.css` using media queries and flexible layouts (e.g., Flexbox, Grid) as needed.
3.  **Add User Feedback:**
    *   **Goal:** Provide clearer feedback to the user during operations.
    *   **Tasks:**
        *   Replace `alert()` calls in `script.js` with less intrusive notifications (e.g., small messages appearing on the page).
        *   Show loading indicators during API calls (form submission, list loading).

**Phase 3: Advanced Features & Deployment**

1.  **User Accounts & Authentication:**
    *   **Goal:** Allow multiple users to use the app securely with their own private expense lists.
    *   **Tasks:**
        *   Choose an authentication strategy (e.g., username/password with libraries like Passport.js, OAuth).
        *   Modify the backend to associate expenses with user IDs.
        *   Add login/signup pages to the frontend.
2.  **Database Integration:**
    *   **Goal:** Replace the `data.json` file with a more robust database (e.g., SQLite for simplicity, PostgreSQL, MongoDB).
    *   **Tasks:**
        *   Choose a database and install the necessary Node.js driver/ORM (e.g., `sqlite3`, `pg`, `mongoose`).
        *   Refactor `readData` and `writeData` functions in `server.js` to interact with the database.
        *   Handle database migrations if the schema changes.
3.  **Reporting & Analytics:**
    *   **Goal:** Provide insights into spending patterns.
    *   **Tasks:**
        *   Add backend endpoints to calculate summaries (e.g., total spending by type, spending over time).
        *   Display basic charts or summaries on the frontend.
4.  **Deployment:**
    *   **Goal:** Make the application accessible online.
    *   **Tasks:**
        *   Choose a hosting platform (e.g., Heroku, Vercel, AWS, Azure).
        *   Configure the application for production (e.g., environment variables for port, database credentials).
        *   Set up a deployment pipeline (e.g., using Git hooks, GitHub Actions).