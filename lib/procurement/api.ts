import { getAuthContext } from "@/lib/auth/session";
import { hasDatabaseConfig } from "@/lib/db/env";
import { calculateCart } from "@/lib/procurement/catalog";
import {
  centreOrders,
  consolidatedOrders,
  procurementCategories,
  procurementProducts,
} from "@/lib/procurement/data";
import type {
  CartItem,
  OrderStatus,
  ProcurementCategory,
} from "@/lib/procurement/types";
import {
  getProcurementReportsFromDb,
  listCentreOrdersFromDb,
  listConsolidatedSupplierOrdersFromDb,
  listOrdersForCentreFromDb,
  listOrdersForSupplierFromDb,
  listProductCategoriesFromDb,
  listProductsFromDb,
} from "@/lib/repositories/procurement";
import { getInternalUserByClerkId } from "@/lib/repositories/users";
import { createCentreProcurementOrder } from "@/lib/services/procurement";

export async function listProducts(
  category?: ProcurementCategory | "All"
) {
  if (hasDatabaseConfig()) {
    return listProductsFromDb(category);
  }

  if (!category || category === "All") {
    return procurementProducts;
  }

  return procurementProducts.filter(
    (product) => product.category === category
  );
}

export async function listCategories() {
  if (hasDatabaseConfig()) {
    return listProductCategoriesFromDb() as Promise<
      ProcurementCategory[]
    >;
  }

  return procurementCategories;
}

export async function listCentreOrders(
  filters: {
    status?: OrderStatus | "All";
    query?: string;
    region?: string;
    month?: string;
    supplier?: string;
  } = {}
) {
  if (hasDatabaseConfig()) {
    return listCentreOrdersFromDb(filters);
  }

  return centreOrders.filter((order) => {
    const matchesStatus =
      !filters.status ||
      filters.status === "All" ||
      order.status === filters.status;

    const query = filters.query?.toLowerCase() ?? "";

    const suppliers = order.items
      .map(
        (item) =>
          procurementProducts.find(
            (product) => product.id === item.productId
          )?.supplierBrand ?? ""
      )
      .join(" ");

    const matchesQuery =
      !query ||
      [
        order.centreName,
        order.orderNumber,
        order.region,
        order.status,
        suppliers,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

    const matchesRegion =
      !filters.region ||
      filters.region === "All" ||
      order.region === filters.region;

    const matchesMonth =
      !filters.month ||
      filters.month === "All" ||
      order.month === filters.month;

    return (
      matchesStatus &&
      matchesQuery &&
      matchesRegion &&
      matchesMonth
    );
  });
}

export async function listCurrentCentreOrders() {
  if (!hasDatabaseConfig()) {
    return centreOrders.filter(
      (order) => order.centreId === "little-stars-ecd"
    );
  }

  const authContext = await getAuthContext();

  if (!authContext) {
    return [];
  }

  const user = await getInternalUserByClerkId(
    authContext.userId
  );

  const centreId =
    user?.centreUsers[0]?.centreId;

  return centreId
    ? listOrdersForCentreFromDb(centreId)
    : [];
}

export async function listCurrentSupplierOrders() {
  if (!hasDatabaseConfig()) {
    return centreOrders;
  }

  const authContext = await getAuthContext();

  if (!authContext) {
    return [];
  }

  const user = await getInternalUserByClerkId(
    authContext.userId
  );

  const supplierId =
    user?.supplierUsers[0]?.supplierId;

  return supplierId
    ? listOrdersForSupplierFromDb(supplierId)
    : [];
}

export async function listConsolidatedOrders() {
  if (hasDatabaseConfig()) {
    return listConsolidatedSupplierOrdersFromDb();
  }

  return consolidatedOrders;
}

export async function createMonthlyOrder(input: {
  budget: number;
  items: CartItem[];
  overrideBudget?: boolean;
}) {
  const normalisedInput = {
    ...input,
    overrideBudget: input.overrideBudget ?? false,
  };

  if (hasDatabaseConfig()) {
    const authContext = await getAuthContext();

    if (!authContext) {
      throw new Error("Authentication required.");
    }

    const user = await getInternalUserByClerkId(
      authContext.userId
    );

    const centreId =
      user?.centreUsers[0]?.centreId;

    if (!centreId) {
      throw new Error(
        "No centre ownership found for the current user."
      );
    }

    return createCentreProcurementOrder(
      centreId,
      normalisedInput,
      user.id
    );
  }

  const totals = calculateCart(
    normalisedInput.items,
    procurementProducts
  );

  return {
    id: `order-${Date.now()}`,
    orderNumber: `ECD-2026-07-${Math.floor(
      Math.random() * 900 + 100
    )}`,
    invoiceNumber: `INV-ECD-2026-${Math.floor(
      Math.random() * 900 + 100
    )}`,
    totals,
    status: "Awaiting Approval" as const,
  };
}

export async function getProcurementReports() {
  if (hasDatabaseConfig()) {
    return getProcurementReportsFromDb();
  }

  const monthlyValue = centreOrders.reduce(
    (sum, order) =>
      sum +
      calculateCart(
        order.items,
        procurementProducts
      ).total,
    0
  );

  return {
    monthlyValue,
    topProducts: procurementProducts
      .slice(0, 8)
      .map((product, index) => ({
        label: product.name,
        value: 42 - index * 3,
      })),
    centreSpending: centreOrders.map((order) => ({
      label: order.centreName,
      value: calculateCart(
        order.items,
        procurementProducts
      ).total,
    })),
    supplierPerformance: [
      {
        label: "FreshStart Foods",
        value: 94,
      },
      {
        label: "Ubuntu Supply",
        value: 87,
      },
      {
        label: "CleanCare",
        value: 82,
      },
    ],
    deliveryPerformance: [
      {
        label: "Delivered",
        value: 68,
      },
      {
        label: "Packed",
        value: 22,
      },
      {
        label: "Pending",
        value: 10,
      },
    ],
    topCategories: [],
    topCentres: [],
    supplierSpend: [],
    averageBasketSize: 0,
    budgetUtilisation: [],
  };
}

export type ProcurementReport = Awaited<
  ReturnType<typeof getProcurementReports>
>;