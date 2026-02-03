import { z } from 'zod';

// Authentication validation schemas
export const signUpSchema = z.object({
  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  username: z.string()
    .trim()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(50, { message: "Username must be less than 50 characters" })
    .regex(/^[a-zA-Z0-9_]+$/, { message: "Username can only contain letters, numbers, and underscores" }),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(128, { message: "Password must be less than 128 characters" }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const signInSchema = z.object({
  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z.string()
    .min(1, { message: "Password is required" })
    .max(128, { message: "Password must be less than 128 characters" }),
});

// Ticket validation schemas
export const ticketSchema = z.object({
  tournament_name: z.string()
    .trim()
    .min(1, { message: "Tournament name is required" })
    .max(200, { message: "Tournament name must be less than 200 characters" }),
  venue: z.string()
    .trim()
    .min(1, { message: "Venue is required" })
    .max(200, { message: "Venue must be less than 200 characters" }),
  event_date: z.string()
    .min(1, { message: "Event date is required" }),
  buy_in: z.number()
    .positive({ message: "Buy-in must be a positive number" })
    .max(100000000, { message: "Buy-in must be less than $1,000,000" }), // 100M cents = $1M
  money_guarantee: z.number()
    .positive({ message: "Money guarantee must be a positive number" })
    .max(1000000000, { message: "Money guarantee must be less than $10,000,000" }) // 1B cents = $10M
    .optional()
    .nullable(),
  asking_price: z.number()
    .positive({ message: "Asking price must be a positive number" })
    .max(100000000, { message: "Asking price must be less than $1,000,000" }), // 100M cents = $1M
  description: z.string()
    .trim()
    .max(2000, { message: "Description must be less than 2000 characters" })
    .refine(
      (val) => !val || !/<script|<iframe|javascript:|on\w+=/i.test(val),
      { message: "Description cannot contain HTML tags or scripts" }
    )
    .optional()
    .nullable(),
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;
export type TicketFormData = z.infer<typeof ticketSchema>;
