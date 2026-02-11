/**
 * Auth Module Exports
 * Clean exports for the auth bounded context
 */

// Domain
export { User } from './domain/entities/User.js';
export { Email } from './domain/valueObjects/Email.js';

// Application Services
export { default as authService } from './application/services/AuthService.js';

// Use Cases
export { default as registerUseCase } from './application/useCases/RegisterUseCase.js';
export { default as loginUseCase } from './application/useCases/LoginUseCase.js';
export { default as googleAuthUseCase } from './application/useCases/GoogleAuthUseCase.js';
export { default as refreshTokenUseCase } from './application/useCases/RefreshTokenUseCase.js';
export { default as forgotPasswordUseCase } from './application/useCases/ForgotPasswordUseCase.js';
export { default as resetPasswordUseCase } from './application/useCases/ResetPasswordUseCase.js';
export { default as verifyEmailUseCase } from './application/useCases/VerifyEmailUseCase.js';
export { default as updateProfileUseCase } from './application/useCases/UpdateProfileUseCase.js';
export { default as getProfileUseCase } from './application/useCases/GetProfileUseCase.js';

// Infrastructure
export { default as userRepository } from './infrastructure/repositories/UserRepository.js';

// Routes
export { default as authRoutes } from './interfaces/http/authRoutes.js';
export { default as userRoutes } from './interfaces/http/userRoutes.js';
