# Imajin Marketplace API

A modern e-commerce marketplace API built with TypeScript, Hono framework, and MikroORM. Features a complete marketplace system with user authentication, product management, shopping cart, and order processing.

## Features

- 🔐 **User Authentication** - Session-based auth with secure password hashing
- 📦 **Product Management** - CRUD operations for products and categories
- 🛒 **Shopping Cart** - Add, update, and remove items from cart
- 📋 **Order Processing** - Complete order management system
- 📚 **API Documentation** - Interactive OpenAPI documentation with Scalar UI
- ✅ **Testing** - Comprehensive test suite with Vitest
- 🗃️ **Database** - SQLite with migrations and seeders

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Hono (lightweight web framework)
- **Database**: SQLite with MikroORM
- **Authentication**: Argon2 password hashing
- **Validation**: Zod schemas
- **Testing**: Vitest
- **API Docs**: OpenAPI with Scalar UI

## Prerequisites

- Node.js v22
- pnpm (recommended package manager)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd imajin-marketplace
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up the database**
   ```bash
   # Run migrations
   pnpm run migration:up
   
   # Seed the database with sample data
   pnpm run seed
   ```

## Environment Variables

Create a `.env` file in the root directory (optional - defaults are provided):

```env
# Session configuration
SESSION_SECRET=your-secret-key-here
SESSION_COOKIE_NAME=sid

# CORS configuration
FRONTEND_URL=http://localhost:3001

# Environment
NODE_ENV=development
```

### Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_SECRET` | Secret key for session encryption | `rahasia` |
| `SESSION_COOKIE_NAME` | Name of the session cookie | `sid` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3001` |
| `NODE_ENV` | Environment mode | `development` |

## Running the Project

### Development
```bash
pnpm run dev
```
The server will start at `http://localhost:3000` with hot reload enabled.

### Production
```bash
# Build the project
pnpm run build

# Start the production server
pnpm start
```

## API Documentation

Once the server is running, you can access:

- **Interactive API Documentation**: `http://localhost:3000/api/v1/docs`
- **OpenAPI JSON**: `http://localhost:3000/api/v1/openapi.json`
- **Health Check**: `http://localhost:3000/api/v1/health-check`

The API is available at the base path `/api/v1/`.

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Start development server with hot reload |
| `pnpm run build` | Build the TypeScript project |
| `pnpm start` | Start production server |
| `pnpm test` | Run test suite |
| `pnpm run format` | Format code with Prettier |
| `pnpm run migration:create` | Create a new database migration |
| `pnpm run migration:up` | Run pending migrations |
| `pnpm run migration:down` | Rollback last migration |
| `pnpm run migration:cache` | Generate migration cache |
| `pnpm run seed` | Run database seeders |

## Database Management

The project uses SQLite with MikroORM for database operations.

### Database File
- Location: `sqlite.db` (in project root)
- Automatically created when running migrations

### Migrations
```bash
# Create a new migration
pnpm run migration:create

# Run all pending migrations
pnpm run migration:up

# Rollback the last migration
pnpm run migration:down
```

### Seeding
```bash
# Populate database with sample data
pnpm run seed
```

## Project Structure

```
src/
├── auth/           # Authentication system
├── cart/           # Shopping cart functionality  
├── category/       # Product categories
├── order/          # Order management
├── product/        # Product management
├── seeders/        # Database seeders and factories
├── migrations/     # Database migrations
├── config.ts       # App configuration
├── database.ts     # Database connection
├── error.ts        # Error handling
└── index.ts        # App entry point
```

## Testing

Run the test suite:
```bash
pnpm test
```

Tests are located alongside their respective modules with `.test.ts` extension.

## Development

The project follows these conventions:
- TypeScript with strict mode enabled
- Prettier for code formatting
- Entity-based architecture with services and controllers
- Comprehensive error handling
- Session-based authentication

## API Endpoints

Main endpoint categories:
- `/api/v1/auth/*` - Authentication (register, login, logout)
- `/api/v1/products/*` - Product management
- `/api/v1/categories/*` - Category management  
- `/api/v1/cart/*` - Shopping cart operations
- `/api/v1/orders/*` - Order processing

For detailed endpoint documentation, visit the interactive docs at `/api/v1/docs` when running the server.
