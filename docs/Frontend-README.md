# OpenRadius Frontend

React 19 + TypeScript + Vite application with enterprise authentication and comprehensive UI features.

## Tech Stack

- **React 19** - Latest React with modern hooks
- **TypeScript** - Type safety
- **Vite 7.3** - Fast build tool
- **TanStack Query v5** - Server state management
- **React Router v7** - Routing
- **Tailwind CSS** - Utility-first CSS
- **shadcn/ui** - High-quality React components
- **Keycloak JS** - OIDC authentication
- **Axios** - HTTP client

## Key Features

### 🔐 Authentication
- OIDC authentication with Keycloak
- Automatic token refresh
- Protected routes
- Role-based access control

### 🗑️ Soft Delete & Trash Management
All pages support soft delete functionality:
- **Delete**: Items move to trash instead of permanent deletion
- **Trash View**: Toggle between active and deleted items
- **Restore**: Recover deleted items from trash
- **Confirmation Dialogs**: AlertDialog confirmations for all destructive actions

#### Pages with Trash Support
1. **RADIUS Users** - Manage user deletions and restores
2. **RADIUS Profiles** - Manage profile deletions and restores  
3. **SAS RADIUS Integrations** - Manage integration deletions and restores
4. **OIDC Providers** - Manage provider deletions and restores (default provider protected)

#### UI Components
- **Archive Button**: Toggle trash view on/off
- **Restore Icon**: Green rotate icon for restoring items
- **Confirmation Dialogs**: Uses shadcn/ui AlertDialog component
- **Toast Notifications**: Success/error feedback via sonner

### 📊 Data Management
- Virtual scrolling for large datasets
- Pagination with configurable page sizes
- Search and filtering
- Real-time sync capabilities

## Development

Currently, two official Vite plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
