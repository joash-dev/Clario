# Clario

Clario is a full-stack productivity platform that combines task management, note-taking, and AI-assisted workflows in one experience.

This repository contains both the mobile app and backend API used to power the product.

## What Clario Includes

- User authentication and profile management
- Task tracking and organization
- Note creation and editing
- AI-powered productivity features

## Repository Overview

- `apps/mobile` - Expo + React Native client application
- `apps/api` - Express + TypeScript backend API

## Technology

- **Frontend:** React Native, Expo, Expo Router, TypeScript
- **Backend:** Node.js, Express, Prisma
- **Data:** PostgreSQL
- **AI:** Configurable provider support (OpenAI and Gemini)

## Getting Started

At a high level:

1. Install dependencies for both `apps/api` and `apps/mobile`
2. Create local environment files from each app's `.env.example`
3. Start the API
4. Point the mobile app to the API base URL
5. Start the mobile app with Expo

## Development Notes

- API routes are versioned under `/api/v1`
- Environment variables are required for local development
- Keep `.env` files local and out of source control

## Status

Clario is under active development, and implementation details may evolve as features are expanded.
