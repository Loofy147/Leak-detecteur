# LeakDetector

LeakDetector is a SaaS application that helps businesses identify and eliminate financial waste by analyzing their transaction data for recurring subscriptions. It uses the Plaid API to connect to a company's bank accounts, fetches transaction data, and then uses an AI-powered analysis to identify potential leaks, such as unused subscriptions, duplicate services, or opportunities to switch to free alternatives.

## Key Features

- **Plaid Integration:** Securely connect to bank accounts and fetch transaction data.
- **Recurring Charge Detection:** Automatically identify recurring subscriptions from transaction history.
- **AI-Powered Analysis:** Use a large language model to analyze subscriptions and identify potential financial waste.
- **Automated Reporting:** Generate and email a detailed report of the findings, including actionable recommendations.
- **Stripe Integration:** Process one-time payments for the audit service.

## Architecture Overview

This is a Next.js application with a serverless backend architecture. The key components are:

- **Next.js API Routes:** All backend logic is implemented as a set of API routes in the `pages/api` directory.
- **Supabase:** The PostgreSQL database for storing audit data, transactions, and identified leaks.
- **Plaid:** The financial data aggregator used to connect to bank accounts and fetch transactions.
- **Stripe:** The payment processor for handling the one-time audit fee.
- **Anthropic:** The AI provider used for the subscription analysis.
- **Resend:** The email service for sending the final report.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm
- A Supabase account and project
- A Plaid developer account
- A Stripe developer account
- An Anthropic API key
- A Resend API key

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/leak-detector.git
    cd leak-detector
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**

    Create a `.env.local` file in the root of the project and add the following environment variables:

    ```
    # Supabase
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

    # Plaid
    PLAID_CLIENT_ID=your_plaid_client_id
    PLAID_SECRET=your_plaid_secret
    PLAID_ENV=sandbox

    # Stripe
    STRIPE_SECRET_KEY=your_stripe_secret_key
    STRIPE_PRICE_ID=your_stripe_price_id
    STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

    # Anthropic
    ANTHROPIC_API_KEY=your_anthropic_api_key

    # Resend
    RESEND_API_KEY=your_resend_api_key
    FROM_EMAIL=you@yourdomain.com

    # App
    NEXT_PUBLIC_APP_URL=http://localhost:3000
    ```

4.  **Set up the database schema:**

    Execute the SQL in `leakdetector_schema.sql` in your Supabase project's SQL editor to create the necessary tables.

### Running the Application

To run the application in development mode, use the following command:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Usage

The application flow is as follows:

1.  A user lands on the marketing page and clicks the "Get Your Audit" button.
2.  They are prompted to enter their email address and company name.
3.  They are redirected to a Stripe Checkout page to pay the one-time audit fee.
4.  After a successful payment, they are redirected to a success page where they are prompted to connect their bank account using the Plaid Link flow.
5.  Once they have connected their bank account, the application fetches the last 12 months of transaction data.
6.  The transaction data is analyzed for recurring charges.
7.  The recurring charges are sent to the Anthropic API for analysis to identify potential leaks.
8.  The identified leaks are stored in the database.
9.  A report is generated and emailed to the user.

## Testing

This project uses Jest for testing. To run the tests, use the following command:

```bash
npm test
```
