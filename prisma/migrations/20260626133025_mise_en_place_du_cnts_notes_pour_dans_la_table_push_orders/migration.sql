-- Migration reconstruite manuellement (déjà appliquée en base)
ALTER TABLE "purchase_orders" ADD COLUMN "cntsNotes" TEXT;
