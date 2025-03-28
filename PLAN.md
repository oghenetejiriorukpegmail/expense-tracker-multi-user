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

## 4. Development Steps

1.  **Create GitHub Repository:** Set up the `expenses-app` repository (Completed).
2.  **Basic Project Structure:** Create `frontend` and `backend` folders. Initialize the Node.js project in the `backend` directory.
3.  **Backend Server Setup:** Implement a basic Express server with API endpoints for:
    *   `POST /api/expenses` (Add new expense with optional image)
    *   `GET /api/expenses` (Retrieve all expenses)
    *   `GET /api/expenses/export` (Generate and download Excel file)
4.  **Frontend UI:** Build the HTML form for expense entry and a section to display the expense list. Style using CSS for mobile responsiveness.
5.  **Frontend Interaction:** Write JavaScript to:
    *   Handle form submission, sending data (including the image file) to the backend `POST` endpoint.
    *   Fetch the expense list from the `GET` endpoint and display it.
    *   Trigger the Excel download from the `GET /export` endpoint.
6.  **Backend Storage & Image Handling:**
    *   Implement logic in the `POST /api/expenses` endpoint to save expense details to a `data.json` file.
    *   Handle file uploads (e.g., using `multer`) and save images to an `uploads` directory on the server. Store the image path with the expense data.
7.  **Backend OCR Integration:**
    *   Integrate an OCR library (like `tesseract.js` or similar).
    *   Modify the `POST /api/expenses` endpoint: if an image is uploaded, run OCR on it.
    *   Attempt to parse the extracted text to find potential Date and Cost values.
    *   *Initial thought:* Send suggestions back. *Revised approach for simplicity:* Directly save extracted data if found, or save manually entered data otherwise. User can edit later if needed.
8.  **Frontend OCR Handling:** (Simplified based on revised backend approach) Ensure the form correctly sends manual data and the image. The backend handles the OCR attempt during saving.
9.  **Backend Excel Export:** Implement the `GET /api/expenses/export` endpoint. Read data from `data.json`, format it using the `xlsx` library, and send the file back to the client for download.
10. **Refinement:** Add input validation (frontend and backend), error handling (e.g., failed OCR, file issues), and general UI/UX improvements.