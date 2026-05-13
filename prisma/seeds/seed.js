import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Démarrage du seeder Vita-Link...\n");

  // ─── Admin ────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || "admin@vita-link.sn";
  const adminPassword = process.env.ADMIN_PASSWORD || "Liverpool040";
  const adminPhone = process.env.ADMIN_PHONE || "+221770000000";

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`⚠️  Admin déjà existant : ${adminEmail} — seed ignoré`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        phone: adminPhone,
        passwordHash,
        role: "ADMIN",
        firstName: "Super",
        lastName: "Admin",
        isActive: true,
        isAvailable: false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    console.log("✅ Administrateur créé :");
    console.log(`   → ID    : ${admin.id}`);
    console.log(`   → Email : ${admin.email}`);
    console.log(`   → Rôle  : ${admin.role}`);
    console.log(`   → Mot de passe : ${adminPassword}`);
    console.log("\n⚠️  Changez le mot de passe en production !\n");
  }

  console.log("✅ Seeder terminé.");
}

main()
  .catch((err) => {
    console.error("❌ Erreur seeder :", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
