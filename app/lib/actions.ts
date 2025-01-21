"use server";

import { z } from "zod";
import { db } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { InvoicesTable } from "./definitions";

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(["pending", "paid"]),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
  const client = await db.connect();
  try {
    const { customerId, amount, status } = CreateInvoice.parse({
      customerId: formData.get("customerId"),
      amount: formData.get("amount"),
      status: formData.get("status"),
    });
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split("T")[0];

    await client.sql<InvoicesTable>`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;

    revalidatePath("/dashboard/invoices");
    redirect("/dashboard/invoices");
  } catch (error: any) {
    //check if error message is NEXT_REDIRECT
    if (error.message === "NEXT_REDIRECT") {
      throw error; // ... yes.. this redirects to the /dashboard/invoices page.
    } else {
      console.error("Validation Error:", error);
      throw new Error("Invalid form data.");
    }
  } finally {
    client.release();
  }
}

export async function updateInvoice(id: string, formData: FormData) {
  const client = await db.connect();
  try {
    const { customerId, amount, status } = UpdateInvoice.parse({
      customerId: formData.get("customerId"),
      amount: formData.get("amount"),
      status: formData.get("status"),
    });

    const amountInCents = amount * 100;

    await client.sql<InvoicesTable>`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
  } catch (error) {
    console.error("Validation Error:", error);
    throw new Error("Invalid form data.");
  } finally {
    client.release();
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  const client = await db.connect();
  try {
    await client.sql<InvoicesTable>`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath("/dashboard/invoices");
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to delete invoice.");
  } finally {
    client.release();
  }
}
