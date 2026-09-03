# Google Play Monitor Dashboard

A modern web-based dashboard for monitoring Google Play apps, reviews, and analytics.

## Features

✅ **Dynamic Search Queries** - Search and filter by any query from your search queries list  
✅ **App Selection** - Monitor specific apps with detailed metrics  
✅ **Real-time Analytics** - View app ratings, review counts, and user engagement  
✅ **Historical Snapshots** - Track app metrics over time  
✅ **Review Monitoring** - Browse recent reviews from users  
✅ **Discovery History** - See search discovery patterns  
✅ **Responsive UI** - Works on desktop and mobile devices

## Setup

### Prerequisites
- Node.js 18+
- Your MongoDB database running
- Environment variables configured (`.env` file in root)

### Installation (from root folder)

1. Install main project dependencies:
```bash
npm install
```

2. Install dashboard dependencies:
```bash
npm install --prefix dashboard
```

3. Create a `.env.local` file in the dashboard folder:
```bash
# From root folder
cp .env dashboard/.env.local
```

Then edit `dashboard/.env.local` to ensure it has:
```env
MONGODB_URI=your_mongodb_uri
DB_NAME=your_database_name
```

### Running the Dashboard (from root folder)

**Development mode:**
```bash
npm run dashboard:dev
```

The dashboard will be available at `http://localhost:3000`

**Production build:**
```bash
npm run dashboard:build
npm run dashboard:start
```

## How to Use

### 1. Search Query Filter
- Left sidebar has "Search Query" input
- Start typing to search through all available search queries
- Click a suggestion or press Enter to select
- Dashboard updates to show all apps found with that query

### 2. App Selector
- Use "Specific App" dropdown to filter to a single app
- Leave blank to view all apps
- Shows total number of available apps

### 3. Dashboard Sections

**🔍 Apps for "[Query]"**
- Appears when a search query is selected
- Shows all apps matching that query
- Displays: Title, Genre, Rating, Total Ratings, Review Count

**📊 Snapshots**
- Appears when an app is selected
- Historical metrics showing rating and review trends
- Helps track app performance over time

**💬 Recent Reviews**
- Latest 10 reviews for selected app
- Shows rating, date, title, and review text
- Useful for sentiment analysis and user feedback

**🔎 Discovery History**
- Appears when a query is selected
- Shows when the query was searched and how many apps were found
- Useful for tracking discovery patterns

## Architecture

```
dashboard/
├── app/
│   ├── page.tsx              # Main dashboard page
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   ├── api/                  # Next.js API routes
│   │   ├── apps/route.ts
│   │   ├── reviews/route.ts
│   │   ├── snapshots/route.ts
│   │   ├── discoveries/route.ts
│   │   └── search-queries/route.ts
│   └── page.module.css       # Page styles
├── components/               # React components
│   ├── Dashboard.tsx         # Main dashboard component
│   ├── Dashboard.module.css
│   ├── SearchQueryInput.tsx  # Query search component
│   ├── SearchQueryInput.module.css
│   ├── AppSelector.tsx       # App selection dropdown
│   └── AppSelector.module.css
├── next.config.js
├── tsconfig.json
└── package.json
```

## API Routes

### GET `/api/search-queries`
Returns list of all available search queries from `search-queries.ts`

**Response:**
```json
{
  "queries": ["casino", "online casino", ...],
  "total": 50
}
```

### GET `/api/apps?packageName=com.example.app&limit=50`
Fetches apps from MongoDB

**Query Parameters:**
- `packageName` (optional) - Filter to specific app
- `limit` (optional, default: 50) - Max results

### GET `/api/reviews?packageName=com.example.app&limit=50`
Fetches reviews for an app

**Query Parameters:**
- `packageName` (required) - App package name
- `limit` (optional, default: 50) - Max results

### GET `/api/snapshots?packageName=com.example.app&limit=100`
Fetches historical snapshots for an app

**Query Parameters:**
- `packageName` (required) - App package name
- `limit` (optional, default: 100) - Max results

### GET `/api/discoveries?query=casino&limit=50`
Fetches discovery history for a search query

**Query Parameters:**
- `query` (optional) - Filter to specific query
- `limit` (optional, default: 50) - Max results

## Styling

The dashboard uses CSS Modules for component styling with:
- **Color Scheme**: Purple gradient (#667eea, #764ba2)
- **Typography**: System fonts with proper hierarchy
- **Responsive Design**: Mobile-first approach
- **Animations**: Smooth transitions and loading states

## Database Requirements

The dashboard expects MongoDB collections:
- `apps` - App information with fields: packageName, title, score, ratings, reviews, genre
- `reviews` - User reviews with fields: packageName, title, body, rating, publishedAt
- `app_snapshots` - Historical snapshots with fields: packageName, snapshot {score, ratings, reviews}, timestamp
- `app_discoveries` - Search history with fields: query, timestamp, apps

## Troubleshooting

**"No apps found"**
- Make sure you've run the sync commands to populate the database
- Check MongoDB connection in `.env.local`

**MongoDB connection error**
- Verify `MONGODB_URI` and `DB_NAME` in `.env.local`
- Ensure MongoDB is running and accessible

**Queries not loading**
- Check that `src/data/search-queries.ts` has query data
- Verify the API route can import from the parent directory

## Future Enhancements

- 📈 Charts and graphs for metrics visualization
- 🔔 Real-time alerts for significant rating changes
- 📊 Export data to CSV/PDF
- 🎯 Advanced filtering and sorting
- 💾 Saved dashboard views/bookmarks
- 🌙 Dark mode
