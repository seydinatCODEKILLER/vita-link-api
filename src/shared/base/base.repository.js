import { prisma } from "../../config/database.js";

export class BaseRepository {
  /**
   * @param {import("@prisma/client").PrismaClient[keyof import("@prisma/client").PrismaClient]} model
   * Le modèle Prisma injecté (ex: prisma.user, prisma.event)
   */
  constructor(model) {
    this.model = model;
    this.prisma = prisma;
  }

  /**
   * Vérifie si un ID est un UUID v4 valide
   * (Évite les crashes Prisma sur les IDs malformés)
   */
  static isValidId(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  /**
   * Trouve une entité par son ID
   */
  findById(id, options = {}) {
    if (!BaseRepository.isValidId(id)) return null;
    return this.model.findUnique({
      where: { id },
      ...options,
    });
  }

  /**
   * Trouve une seule entité par critères (index unique)
   */
  findOne(where, options = {}) {
    return this.model.findUnique({
      where,
      ...options,
    });
  }

  /**
   * Trouve la première entité correspondante (index non unique)
   */
  findFirst(where, options = {}) {
    return this.model.findFirst({
      where,
      ...options,
    });
  }

  /**
   * Trouve plusieurs entités avec pagination optionnelle
   * @param {object} where - Filtres Prisma
   * @param {object} options - { page, limit, sort, select, include, ... }
   */
  findMany(where = {}, options = {}) {
    const { page, limit, sort, ...rest } = options;

    if (!page || !limit) {
      return this.model.findMany({
        where,
        orderBy: sort || { createdAt: "desc" },
        ...rest,
      });
    }

    return this.model.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: sort || { createdAt: "desc" },
      ...rest,
    });
  }

  /**
   * Trouve plusieurs entités + compte total (utile pour la pagination)
   * Retourne { data, total } en une seule transaction
   */
  async findManyWithCount(where = {}, options = {}) {
    const { page, limit, sort, ...rest } = options;

    const [data, total] = await this.prisma.$transaction([
      this.model.findMany({
        where,
        skip: page && limit ? (page - 1) * limit : undefined,
        take: limit || undefined,
        orderBy: sort || { createdAt: "desc" },
        ...rest,
      }),
      this.model.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Crée une nouvelle entité
   */
  create(data, options = {}) {
    return this.model.create({
      data,
      ...options,
    });
  }

  /**
   * Crée plusieurs entités en une seule requête
   */
  createMany(data) {
    return this.model.createMany({ data });
  }

  /**
   * Met à jour par ID
   */
  update(id, data, options = {}) {
    if (!BaseRepository.isValidId(id)) return null;
    return this.model.update({
      where: { id },
      data,
      ...options,
    });
  }

  /**
   * Met à jour plusieurs entités par critères
   */
  updateMany(where, data) {
    return this.model.updateMany({ where, data });
  }

  /**
   * Upsert — crée ou met à jour selon le critère unique
   */
  upsert(where, create, update, options = {}) {
    return this.model.upsert({
      where,
      create,
      update,
      ...options,
    });
  }

  /**
   * Supprime par ID
   */
  delete(id) {
    if (!BaseRepository.isValidId(id)) return null;
    return this.model.delete({ where: { id } });
  }

  /**
   * Supprime plusieurs entités par critères
   */
  deleteMany(where) {
    return this.model.deleteMany({ where });
  }

  /**
   * Compte le nombre d'entités
   */
  count(where = {}) {
    return this.model.count({ where });
  }

  /**
   * Vérifie l'existence d'une entité
   */
  async exists(where) {
    const count = await this.model.count({ where });
    return count > 0;
  }

  /**
   * Agrégation (SUM, AVG, MIN, MAX, COUNT)
   * Utile pour les stats événements (entrées, taux de présence)
   */
  aggregate(args) {
    return this.model.aggregate(args);
  }

  /**
   * Group by — utile pour les stats par statut, par device, etc.
   */
  groupBy(args) {
    return this.model.groupBy(args);
  }
}