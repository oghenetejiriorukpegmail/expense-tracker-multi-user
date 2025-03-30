# Prompt for Generating the Expenses Tracking Application

## Objective

Create a full-stack web application for tracking personal expenses. The application should allow users to manually add expenses and upload receipt images, using Optical Character Recognition (OCR) to extract details automatically.

## Core Features

1.  **Backend (Node.js/Express):**
    *   Set up an Express server.
    *   API endpoints for:
        *   Adding a new expense (manual entry).
        *   Uploading a receipt image.
        *   Processing the uploaded image using OCR (e.g., Tesseract.js or a cloud-based OCR service) to extract relevant information (vendor, date, total amount).
        *   Retrieving a list of all expenses.
        *   (Optional) Deleting or editing expenses.
    *   Store expense data (e.g., in-memory, JSON file, or a simple database).
    *   Handle file uploads securely.
    *   Include basic error handling.

2.  **Frontend (HTML, CSS, JavaScript):**
    *   **Main Page (`index.html`, `script.js`, `style.css`):**
        *   Display a list of existing expenses.
        *   A form to manually add a new expense (description, amount, date, category).
        *   A form/button to upload a receipt image.
        *   Fetch data from the backend API to display expenses.
        *   Send data to the backend API to add expenses and upload receipts.
        *   Provide visual feedback during uploads and processing.
    *   **Settings Page (`settings.html`, `settings.js`):**
        *   (Optional) Allow configuration of settings, like expense categories or OCR parameters.

3.  **OCR Integration (`utils/ocr.js`):**
    *   Implement a utility module to handle the OCR processing logic. This should take an image file path as input and return the extracted text or structured data.

4.  **Testing (`__tests__`):**
    *   Include basic unit or integration tests for the backend API endpoints. Use a testing framework like Jest. Mock dependencies where necessary.

## Project Structure

Organize the project into distinct `frontend` and `backend` directories.

```
/
├── backend/
│   ├── node_modules/
│   ├── uploads/
│   ├── utils/
│   │   └── ocr.js
│   ├── __tests__/
│   │   └── server.test.js
│   ├── .env
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
├── frontend/
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   ├── settings.html
│   └── settings.js
├── .gitignore
├── PLAN.md
└── README.md
```

## Technologies

*   **Backend:** Node.js, Express.js
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (or a simple framework if preferred)
*   **OCR:** Tesseract.js or similar library/API.
*   **Testing:** Jest (or similar)

## Deliverables

*   Fully functional application source code following the specified structure.
*   A `README.md` explaining how to set up and run the application.
*   A `.gitignore` file appropriate for a Node.js project.