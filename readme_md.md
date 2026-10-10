# 🧾 Utility Bill OCR & Processing Pipeline

A robust Python-based Optical Character Recognition (OCR) pipeline powered by **Gemini Flashlite 3.5**, designed to extract key billing information from Pakistani utility bills (including IESCO, LESCO, and KESC).

This project automates the extraction of critical data points such as **Account Numbers**, **Total Amounts Due**, and **Due Dates** from scanned images or photos of physical bills. By leveraging the advanced vision capabilities of Gemini Flashlite 3.5, it handles varying image qualities and formats with high accuracy. It also includes an automated testing suite to validate extraction accuracy against ground-truth CSV data.

## ✨ Features

* **AI-Powered OCR:** Utilizes **Gemini Flashlite 3.5** for state-of-the-art document understanding and data extraction.

* **Multi-Provider Support:** Processes bills from major providers like IESCO, LESCO, and KESC.

* **Key Data Extraction:** Accurately isolates and extracts account details and financial amounts.

* **Automated Evaluation:** Built-in testing pipeline that unzips test images, processes them, and compares the output against expected results in a CSV file.

* **Accuracy Reporting:** Generates a detailed pass/fail report to calculate the overall accuracy of the OCR pipeline.

## 📂 Project Structure

```
├── src/
│   ├── main.py             # Main application and API logic
│   └── ocr_engine.py       # Gemini Flashlite 3.5 extraction functions (parse_utility_bill)
├── tests/
│   ├── run_test.py         # Automated testing script
│   ├── bills.zip           # Zipped archive of test images (e.g., IESCO_0001.jpg)
│   ├── level1.csv          # Ground-truth data for clean/high-res bills
│   └── level2.csv          # Ground-truth data for folded/low-res bills
├── requirements.txt        # Python dependencies
├── .env.example            # Example environment variables file
└── README.md               # Project documentation

```

## 🚀 Installation

1. **Clone the repository:**

   ```
   git clone https://github.com/yourusername/utility-bill-ocr.git
   cd utility-bill-ocr
   
   ```

2. **Create a virtual environment (Recommended):**

   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   
   ```

3. **Install dependencies:**

   ```
   pip install -r requirements.txt
   
   ```

4. **Set up your API Key:**
   Since this project uses Gemini Flashlite 3.5, you need a Google Gemini API key.

   * Create a `.env` file in the root directory.

   * Add your API key to the file:

     ```
     GEMINI_API_KEY=AQ.Ab8RN6J14XPWX_i6MjXm65k92md9GdPyVUZd5b2KPTZfC_rdzQ
     
     ```

## 💻 Usage

To extract data from a single utility bill image using Gemini:

```
from src.ocr_engine import parse_utility_bill

image_path = "path/to/your/bill.jpg"
extracted_data = parse_utility_bill(image_path)

print(extracted_data)
# Output: {'account_number': '123456789', 'total_amount': '4500', 'due_date': '15-Oct-2023'}

```

## 🧪 Running Tests (Zip & CSV)

The project includes an automated test runner that unpacks a `.zip` file of bill images and compares the Gemini OCR output against a ground-truth CSV file.

1. Ensure your `bills.zip` and `level1.csv` are placed in the `tests/` directory.

2. The CSV should contain columns matching your extraction keys (e.g., `filename`, `account_number`, `total_amount`).

3. Run the test script from the root directory:

```
python tests/run_test.py

```

**Expected Output:**
The script will extract the zip file to a temporary folder, process each image via Gemini Flashlite 3.5, and output a summary report in the console:

```
================ TEST SUMMARY ================
         Filename  Account Match  Amount Match Status
0  IESCO_0001.jpg           True          True   PASS
1  LESCO_0002.png           True         False   FAIL
2   KESC_0003.jpg           True          True   PASS

Overall Extraction Accuracy: 66.67%

```

## 🤝 Contributing

Contributions are welcome! If you'd like to improve the prompting for Gemini, add support for new bill providers, or enhance the testing suite, please fork the repository and submit a pull request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.