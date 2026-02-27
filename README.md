## Portfolio Backend (Server)

Express.js backend that powers the **contact form** for my portfolio. It exposes a simple email API using **Nodemailer**.
---

### Tech Stack

- **Runtime**: Node.js
- **Framework**: Express 4
- **Email**: Nodemailer (Gmail SMTP)
- **Config**: dotenv
- **CORS**: `cors` middleware

---

---

### API

#### Health Check

- **Method**: `GET`
- **URL**: `/health`
- **Response**:

```json
{
  "status": "Backend server is running"
}
```

#### Send Email

- **Method**: `POST`
- **URL**: `/api/send-email`
- **Body**:

```json
{
  "name": "Your Name",
  "email": "your-email@example.com",
  "message": "Your message..."
}
```

- **Success response**:

```json
{
  "success": true,
  "message": "Email sent successfully! I will get back to you soon."
}
```

- **Error responses**:
  - `400` – validation issues (missing fields, invalid email, short message).
  - `500` – email transport or internal server error.

---

### Environment Variables

Create a `.env` file in the `server/` directory:

```bash
GMAIL_EMAIL=your-email@gmail.com
GMAIL_PASSWORD=your-app-specific-password
PORT=5000
```

- `GMAIL_EMAIL`: the Gmail address you want to send from and receive to.
- `GMAIL_PASSWORD`: **App-specific password**, not your main Gmail password. See Google’s documentation on app passwords (`https://support.google.com/accounts/answer/185833`).
- `PORT`: port for the Express server (defaults to `5000` if not set).

---

### Running the Server

#### Install dependencies

```bash
cd server
npm install
```

#### Development mode

Uses `nodemon` to watch `server.js`:

```bash
npm run dev
```

#### Production mode

```bash
npm start
```

The server will start on:

```text
http://localhost:5000
```

---
