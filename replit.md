# SmartM007 - Sistema de Vendas

## Overview

SmartM007 is a point-of-sale (POS) and inventory management system designed for grocery stores and small markets. The application provides a complete solution for sales transactions, product management, reporting, user management, and task tracking. It features role-based access control (admin, manager, seller), real-time notifications, audit logging, and comprehensive reporting capabilities.

The system is built as a full-stack TypeScript application with a React frontend and Express backend, using PostgreSQL (via Neon serverless) for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **React 18** with TypeScript for the UI layer
- **Vite** as the build tool and development server
- **Wouter** for client-side routing (lightweight alternative to React Router)
- **TanStack Query (React Query)** for server state management, caching, and data synchronization
- **Tailwind CSS v4** with custom design tokens for styling
- **shadcn/ui** component library (New York style) with Radix UI primitives

**Design Patterns:**
- Context-based architecture for cross-cutting concerns (Auth, Cart)
- Custom hooks for reusable logic (useAuth, useCart, useToast, useIsMobile)
- Compound component pattern for UI components
- Centralized API client with type-safe interfaces

**State Management Strategy:**
- Server state managed via TanStack Query with aggressive caching
- Authentication state managed via AuthContext
- Shopping cart state managed via CartContext (session-based)
- Local UI state managed via React hooks
- No global state library needed due to React Query's caching

**Styling Approach:**
- Custom design system defined in `index.css` using Tailwind's theme configuration
- Fresh market-inspired color palette (greens, oranges, neutrals)
- Responsive design with mobile-first breakpoints
- Component variants using `class-variance-authority`
- Custom utility classes for elevation effects (hover-elevate, active-elevate-2)

### Backend Architecture

**Technology Stack:**
- **Express.js** for the HTTP server
- **TypeScript** with ES modules
- **Drizzle ORM** for database access with type-safe queries
- **Neon Serverless** PostgreSQL driver
- **bcrypt** for password hashing
- **express-session** for session management

**API Design:**
- RESTful API structure with resource-based endpoints
- Session-based authentication (no JWT)
- Role-based authorization middleware (requireAuth, requireAdmin, requireAdminOrManager)
- Centralized error handling
- Request/response logging middleware

**Development vs Production:**
- Separate entry points (`index-dev.ts` vs `index-prod.ts`)
- Development mode uses Vite middleware for HMR
- Production mode serves pre-built static assets
- Environment-based configuration via process.env

### Data Storage

**Database:**
- **PostgreSQL** hosted on Neon (serverless)
- **Drizzle ORM** for schema definition and migrations
- Schema located in `shared/schema.ts` (shared between client and server)

**Database Schema:**

1. **users** - User accounts with role-based access
   - Fields: id, name, username, password (hashed), role, avatar, createdAt
   - Roles: admin, manager, seller

2. **categories** - Product categories
   - Fields: id, name, color (Tailwind classes), createdAt

3. **products** - Inventory items
   - Fields: id, sku, name, categoryId, price, costPrice, stock (decimal for kg support), minStock, unit, image, createdAt, updatedAt
   - Units: un, kg, g, pack, box

4. **sales** - Transaction records
   - Fields: id, userId, total, amountReceived, change, paymentMethod, items (JSONB), createdAt
   - Payment methods: cash, card, pix, mpesa, emola, pos, bank

5. **notifications** - User notifications
   - Fields: id, userId (nullable for broadcast), type, title, message, read, createdAt

6. **auditLogs** - System activity tracking
   - Fields: id, userId, action, details (JSONB), createdAt

7. **dailyEdits** - Product edit tracking (rate limiting)
   - Fields: id, userId, editDate, editCount

**Data Validation:**
- Zod schemas generated from Drizzle schemas using `drizzle-zod`
- Server-side validation on all API endpoints
- Type-safe data transfer between client and server

### Authentication & Authorization

**Authentication Mechanism:**
- Session-based authentication using `express-session`
- Sessions stored in memory (development) or could be configured for Redis/PostgreSQL
- Password hashing via bcrypt (10 rounds)
- HttpOnly cookies for session token storage

**Authorization Levels:**
1. **Seller** - Basic access to POS, view products, create sales
2. **Manager** - Seller permissions + product management
3. **Admin** - Full system access including user management, audit logs

**Security Measures:**
- Passwords never stored in plaintext
- Session secrets via environment variables
- Role-based middleware guards on protected routes
- CSRF protection via SameSite cookies (production)

### External Dependencies

**Third-Party UI Libraries:**
- Radix UI primitives (@radix-ui/*) for accessible components
- Lucide React for icons
- Recharts for data visualization
- XLSX for Excel import/export
- date-fns for date manipulation

**Development Tools:**
- Replit-specific plugins (vite-plugin-cartographer, vite-plugin-dev-banner, vite-plugin-runtime-error-modal)
- Custom vite-plugin-meta-images for OpenGraph image handling
- ESBuild for production builds
- Drizzle Kit for database migrations

**Database Service:**
- Neon serverless PostgreSQL
- Connection via `@neondatabase/serverless` driver
- DATABASE_URL environment variable required

**Session Storage:**
- `connect-pg-simple` available for PostgreSQL session storage (not currently configured)
- Default in-memory storage for development

**Notable Features:**
- Daily product edit limits per user (tracked in dailyEdits table)
- Real-time notification polling (10-second intervals)
- Low stock alerts via notifications system
- Comprehensive audit logging for administrative actions
- Excel-based product import/export functionality
- Multi-unit product support (pieces, kilograms, grams, packs, boxes)
- Discount system in POS (percentage and fixed amount)
- Change calculation for cash transactions
- Chart-based sales analytics and reporting