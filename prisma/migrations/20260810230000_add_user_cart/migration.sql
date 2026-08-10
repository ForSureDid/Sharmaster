-- Server-side mirror of the localStorage cart for logged-in users — survives
-- a cleared browser/new device, and lets admin see what's sitting in a
-- customer's cart. See context/CartContext.tsx for the CartItem[] shape.
ALTER TABLE "User" ADD COLUMN "cart" JSONB;
ALTER TABLE "User" ADD COLUMN "cartUpdatedAt" TIMESTAMP(3);
