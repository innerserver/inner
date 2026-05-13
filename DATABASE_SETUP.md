# Inner Database Setup

Inner now supports a free MongoDB database using MongoDB Atlas.

## 1. Create a free database

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Create a free shared cluster
3. Create a database user
4. Allow your server IP or use 0.0.0.0/0 for testing
5. Copy the connection string

Example:

mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority

## 2. Set environment variables

Linux/macOS:

```bash
export INNER_DB=mongodb
export MONGODB_URI="your connection string"
export MONGODB_DB="inner"
```

Windows PowerShell:

```powershell
setx INNER_DB mongodb
setx MONGODB_URI "your connection string"
setx MONGODB_DB inner
```

## 3. Install dependencies

```bash
npm install
```

## 4. Start the server

```bash
npm start
```

## Notes

- Existing JSON storage still works as a fallback.
- When MongoDB is enabled, app data is stored in the database automatically.
- Upload files still stay in the uploads folder.
- Use `npm run start:local` to force local JSON storage.
