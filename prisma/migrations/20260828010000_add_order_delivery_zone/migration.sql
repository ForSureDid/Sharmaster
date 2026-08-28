-- Customer-declared delivery region at checkout ("astana" | "other"), used to
-- enforce the 30 000 ₸ minimum order for out-of-town/foreign customers.
ALTER TABLE "Order" ADD COLUMN "deliveryZone" TEXT;
