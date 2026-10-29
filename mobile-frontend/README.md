# Mobile Frontend Directory

## Overview

The `mobile-frontend` directory contains the React Native mobile application for the Optionix platform. This cross-platform mobile application provides users with on-the-go access to options trading analytics, portfolio management, and market data. The mobile frontend is built using modern JavaScript frameworks and follows a component-based architecture for maintainable and scalable development.

## Directory Structure

```
mobile-frontend/
├── .expo/
├── App.js
├── app.json
├── jest.setup.js
├── package.json
├── package-lock.json
└── src/
    ├── __tests__/
    ├── navigation/
    ├── screens/
    └── services/
```

## Components

### Root Files

- **App.js**: The entry point of the React Native application that sets up the root component and initializes the app
- **app.json**: Configuration file for Expo, containing metadata about the application such as name, version, and platform-specific settings
- **jest.setup.js**: Configuration file for the Jest testing framework
- **package.json**: Defines the project dependencies, scripts, and metadata
- **package-lock.json**: Automatically generated file that locks dependency versions for consistent installations

### Source Directory (`src/`)

The `src` directory contains the main application code organized into several subdirectories:

- **tests/**: Contains test files for components and functionality using Jest
- **navigation/**: Manages the application's navigation structure, likely using React Navigation
- **screens/**: Contains screen components that represent full pages in the application
- **services/**: Houses service modules that handle API communication, data processing, and business logic

## Development Setup

### Prerequisites

- Node.js (version specified in package.json)
- npm or yarn package manager
- Expo CLI for development and testing
- Android Studio (for Android development) or Xcode (for iOS development)

### Installation

1. Install dependencies:

   ```bash
   cd mobile-frontend
   npm install
   ```

2. Start the development server:

   ```bash
   npm start
   ```

3. Run on a specific platform:
   ```bash
   npm run android  # For Android
   npm run ios      # For iOS
   ```

## Key Features

The mobile frontend provides users with:

1. **Options Analytics**: Real-time options pricing and analytics
2. **Portfolio Management**: Tracking and managing options positions
3. **Market Data**: Access to real-time and historical market data
4. **Trading Interface**: User-friendly interface for analyzing and executing options trades
5. **Notifications**: Alerts for price movements, expiration dates, and other important events

## Architecture

The mobile frontend follows a component-based architecture with the following key aspects:

1. **Component Hierarchy**: Screen components contain smaller, reusable UI components
2. **State Management**: Likely uses React Context API or Redux for global state management
3. **Navigation**: Uses React Navigation for managing screen transitions and navigation state
4. **API Integration**: Services directory contains modules for communicating with the backend API
5. **Testing**: Jest is used for unit and integration testing

## Integration Points

The mobile frontend integrates with:

1. **Backend API**: Communicates with the Optionix backend for data and business logic
2. **Authentication Services**: Handles user authentication and session management
3. **Push Notification Services**: For delivering alerts and notifications to users
4. **Market Data Providers**: May directly integrate with market data APIs for real-time information
