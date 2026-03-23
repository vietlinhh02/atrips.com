# Validation & Sanitization Guide

Quick reference for using the validation and sanitization utilities in this project.

## 📦 Import Paths

```typescript
// Validation schemas
import {
  redirectUrlSchema,
  chatMessageSchema,
  queryParamSchema,
  emailSchema,
  passwordSchema,
  safeStringSchema,
} from '@/src/lib/validation/schemas';

// Sanitization functions
import {
  sanitizeHtml,
  sanitizeMarkdown,
  sanitizeUrl,
  escapeHtml,
  escapeHtmlSafe,
} from '@/src/lib/sanitize';
```

## 🛡️ Validation Schemas (Zod)

### Use Cases

**When to validate:**
- User form inputs
- URL query parameters
- LocalStorage/SessionStorage data
- API request parameters
- Any untrusted input

### Available Schemas

#### `redirectUrlSchema`
**Purpose:** Validate redirect URLs to prevent open redirect attacks

```typescript
import { redirectUrlSchema } from '@/src/lib/validation/schemas';

try {
  const safeUrl = redirectUrlSchema.parse(userInput);
  // Use safeUrl - guaranteed to be a safe relative URL
} catch (error) {
  // Invalid redirect URL, use default
  console.error('Invalid redirect:', error);
}
```

**Rules:**
- ✅ Must start with `/`
- ❌ Cannot start with `//` (protocol-relative)
- ❌ Cannot contain `javascript:`, `data:`, or `vbscript:`
- ✅ Examples: `/chat`, `/settings?tab=profile`
- ❌ Examples: `//evil.com`, `https://evil.com`, `javascript:alert(1)`

#### `chatMessageSchema`
**Purpose:** Validate chat messages to prevent XSS

```typescript
import { chatMessageSchema } from '@/src/lib/validation/schemas';

try {
  const safeMessage = chatMessageSchema.parse(userMessage);
  // Use safeMessage
} catch (error) {
  console.error('Invalid message:', error);
  // Show error to user
}
```

**Rules:**
- ✅ Min length: 1 character
- ✅ Max length: 10,000 characters
- ❌ Cannot contain `<script` tags
- ❌ Cannot contain event handlers (`onerror=`, `onclick=`, etc.)

#### `queryParamSchema`
**Purpose:** Validate URL query parameters

```typescript
import { queryParamSchema } from '@/src/lib/validation/schemas';

const rawParam = searchParams.get('q');
try {
  const safeParam = queryParamSchema.parse(rawParam);
  // Use safeParam
} catch (error) {
  console.error('Invalid query param:', error);
}
```

**Rules:**
- ✅ Max length: 2,000 characters
- ❌ Cannot contain `<script` tags
- ❌ Cannot contain event handlers

#### `emailSchema`
**Purpose:** Validate email addresses

```typescript
import { emailSchema } from '@/src/lib/validation/schemas';

try {
  const validEmail = emailSchema.parse(email);
  // Use validEmail
} catch (error) {
  // Show "Invalid email address" error
}
```

#### `passwordSchema`
**Purpose:** Validate passwords

```typescript
import { passwordSchema } from '@/src/lib/validation/schemas';

try {
  const validPassword = passwordSchema.parse(password);
  // Use validPassword
} catch (error) {
  // Show error: "Password must be at least 8 characters"
}
```

**Rules:**
- ✅ Min length: 8 characters
- ✅ Max length: 128 characters

#### `safeStringSchema`
**Purpose:** Generic safe string validation

```typescript
import { safeStringSchema } from '@/src/lib/validation/schemas';

try {
  const safeString = safeStringSchema.parse(input);
  // Use safeString
} catch (error) {
  console.error('Invalid input:', error);
}
```

**Rules:**
- ✅ Max length: 1,000 characters
- ❌ Cannot contain `<script` tags

## 🧹 Sanitization Functions

### Use Cases

**When to sanitize:**
- Before rendering user input as HTML
- Before inserting into DOM
- Before storing in database
- Before displaying markdown
- When handling URLs from untrusted sources

### Available Functions

#### `sanitizeHtml(input: string): string`
**Purpose:** Strip ALL HTML tags (for plain text fields)

```typescript
import { sanitizeHtml } from '@/src/lib/sanitize';

const userInput = '<script>alert("xss")</script>Hello';
const safe = sanitizeHtml(userInput);
// Result: "Hello"
```

**Use when:**
- Plain text fields (usernames, titles, descriptions)
- Chat messages that shouldn't contain HTML
- Form inputs
- Search queries

**Removes:**
- All HTML tags
- All JavaScript
- All dangerous content

#### `sanitizeMarkdown(input: string): string`
**Purpose:** Allow only safe markdown/HTML elements

```typescript
import { sanitizeMarkdown } from '@/src/lib/sanitize';

const markdown = '# Title\n<script>alert("xss")</script>\n**Bold**';
const safe = sanitizeMarkdown(markdown);
// Result: "<h1>Title</h1><strong>Bold</strong>"
```

**Use when:**
- Rich text editors
- Markdown content
- AI-generated responses
- Blog posts/comments with formatting

**Allows:**
- Headings (h1-h6)
- Paragraphs (p)
- Formatting (strong, em, u, del, ins)
- Lists (ul, ol, li)
- Links (a with href, title, target, rel)
- Code (code, pre)
- Tables (table, thead, tbody, tr, th, td)
- Misc (blockquote, hr, br)

**Removes:**
- Scripts
- Iframes
- Objects/Embeds
- Event handlers
- Data attributes

#### `sanitizeUrl(url: string): string`
**Purpose:** Block dangerous URL protocols

```typescript
import { sanitizeUrl } from '@/src/lib/sanitize';

// Safe URLs
sanitizeUrl('https://example.com') // → 'https://example.com'
sanitizeUrl('/relative/path')      // → '/relative/path'
sanitizeUrl('mailto:user@email')   // → 'mailto:user@email'

// Dangerous URLs
sanitizeUrl('javascript:alert(1)') // → '#'
sanitizeUrl('data:text/html,...')  // → '#'
sanitizeUrl('vbscript:...')        // → '#'
```

**Use when:**
- Rendering user-provided links
- Handling URLs from API responses
- Building href attributes
- Redirect URLs

**Allows:**
- `http://` and `https://`
- `mailto:`
- Relative URLs (starting with `/` or `#`)
- URLs without protocol (relative paths)

**Blocks:**
- `javascript:`
- `data:`
- `vbscript:`
- `file:`

#### `escapeHtml(input: string): string`
**Purpose:** Escape HTML entities (browser-only)

```typescript
import { escapeHtml } from '@/src/lib/sanitize';

const userInput = '<div>Hello & "World"</div>';
const escaped = escapeHtml(userInput);
// Result: '&lt;div&gt;Hello &amp; &quot;World&quot;&lt;/div&gt;'
```

**Use when:**
- Displaying user input as text in browser
- Preventing HTML interpretation
- Browser-side rendering

**Note:** Uses `document.createElement` (browser-only)

#### `escapeHtmlSafe(input: string): string`
**Purpose:** Escape HTML entities (server-safe)

```typescript
import { escapeHtmlSafe } from '@/src/lib/sanitize';

const userInput = '<script>alert("xss")</script>';
const escaped = escapeHtmlSafe(userInput);
// Result: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
```

**Use when:**
- Server-side rendering
- API responses
- Email content
- Server-side validation

**Escapes:**
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#x27;`
- `/` → `&#x2F;`

## 🎯 Common Patterns

### Pattern 1: Form Input Validation

```typescript
import { emailSchema, passwordSchema } from '@/src/lib/validation/schemas';

function handleLogin(email: string, password: string) {
  try {
    const validEmail = emailSchema.parse(email);
    const validPassword = passwordSchema.parse(password);

    // Proceed with login
    await login(validEmail, validPassword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Show validation errors to user
      console.error(error.errors);
    }
  }
}
```

### Pattern 2: URL Query Parameter

```typescript
import { queryParamSchema } from '@/src/lib/validation/schemas';
import { sanitizeHtml } from '@/src/lib/sanitize';

const rawQuery = searchParams.get('q');
if (rawQuery) {
  try {
    // Validate first
    const validated = queryParamSchema.parse(rawQuery);
    // Then sanitize before use
    const sanitized = sanitizeHtml(validated);
    sendMessage(sanitized);
  } catch (error) {
    console.error('Invalid query:', error);
  }
}
```

### Pattern 3: Redirect URL Validation

```typescript
import { redirectUrlSchema } from '@/src/lib/validation/schemas';

const redirectUrl = searchParams.get('redirect');
if (redirectUrl) {
  try {
    // Validate to prevent open redirect
    const safeRedirect = redirectUrlSchema.parse(redirectUrl);
    router.push(safeRedirect);
  } catch (error) {
    // Use default redirect
    router.push('/');
  }
}
```

### Pattern 4: Rendering User Content

```typescript
import { sanitizeMarkdown } from '@/src/lib/sanitize';

function UserComment({ content }: { content: string }) {
  // Sanitize markdown before rendering
  const safeHtml = sanitizeMarkdown(content);

  return <div dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
```

### Pattern 5: Safe Link Rendering

```typescript
import { sanitizeUrl } from '@/src/lib/sanitize';

function SafeLink({ href, children }: { href: string; children: React.ReactNode }) {
  const safeHref = sanitizeUrl(href);

  return (
    <a href={safeHref} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
```

### Pattern 6: SessionStorage Validation

```typescript
import { chatMessageSchema } from '@/src/lib/validation/schemas';
import { sanitizeHtml } from '@/src/lib/sanitize';

function savePendingMessage(message: string) {
  try {
    // Validate before storing
    const validated = chatMessageSchema.parse(message);
    // Sanitize before storing
    const sanitized = sanitizeHtml(validated);
    sessionStorage.setItem('message', sanitized);
  } catch (error) {
    console.error('Invalid message:', error);
  }
}

function getPendingMessage(): string | null {
  const stored = sessionStorage.getItem('message');
  if (!stored) return null;

  try {
    // Validate on retrieval (defense in depth)
    const validated = chatMessageSchema.parse(stored);
    return validated;
  } catch (error) {
    // Clear invalid data
    sessionStorage.removeItem('message');
    return null;
  }
}
```

## ⚠️ Important Notes

### Validate AND Sanitize

Always use both:
1. **Validate** to reject invalid input
2. **Sanitize** to clean dangerous content

```typescript
// ✅ Good
const validated = schema.parse(input);
const sanitized = sanitizeHtml(validated);

// ❌ Bad - only sanitize
const sanitized = sanitizeHtml(input); // Could still have issues

// ❌ Bad - only validate
const validated = schema.parse(input); // Still has HTML tags
```

### Defense in Depth

Validate at multiple layers:

```typescript
// Layer 1: Validate on save
savePendingMessage(message); // Validates before storing

// Layer 2: Validate on retrieve
getPendingMessage(); // Re-validates after retrieving

// Layer 3: Sanitize before use
const msg = getPendingMessage();
if (msg) {
  const safe = sanitizeHtml(msg); // Extra safety
  use(safe);
}
```

### Choose Right Function

- **Plain text?** → `sanitizeHtml()`
- **Rich text/markdown?** → `sanitizeMarkdown()`
- **URL?** → `sanitizeUrl()`
- **Displaying as text?** → `escapeHtml()` or `escapeHtmlSafe()`

### Error Handling

Always handle validation errors:

```typescript
try {
  const valid = schema.parse(input);
  // Use valid
} catch (error) {
  if (error instanceof z.ZodError) {
    // Zod validation error
    error.errors.forEach(err => {
      console.error(`${err.path}: ${err.message}`);
    });
  }
  // Fallback behavior
}
```

## 🔍 Testing

### Test Validation

```typescript
import { chatMessageSchema } from '@/src/lib/validation/schemas';

// Should pass
chatMessageSchema.parse('Hello world'); // ✅

// Should fail
chatMessageSchema.parse('<script>alert(1)</script>'); // ❌ throws
chatMessageSchema.parse(''); // ❌ throws (too short)
chatMessageSchema.parse('a'.repeat(20000)); // ❌ throws (too long)
```

### Test Sanitization

```typescript
import { sanitizeHtml, sanitizeUrl } from '@/src/lib/sanitize';

// HTML sanitization
expect(sanitizeHtml('<script>alert(1)</script>Hello')).toBe('Hello');
expect(sanitizeHtml('<b>Bold</b>')).toBe('Bold');

// URL sanitization
expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
```

## 📚 References

- Zod documentation: https://zod.dev/
- DOMPurify documentation: https://github.com/cure53/DOMPurify
- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
