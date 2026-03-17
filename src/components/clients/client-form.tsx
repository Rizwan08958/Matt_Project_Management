"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Loader2,
  Mail,
  Paperclip,
  Phone,
  Search,
  Star,
  User,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { createClient, updateClient } from "@/actions/client.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ClientFormProps {
  client?: {
    id: string;
    name: string;
    collegeName: string | null;
    email: string;
    phone: string | null;
    street: string | null;
    city: string | null;
    zip: string | null;
    state: string | null;
    country: string | null;
    tags: string | null;
    address: string | null;
    notes: string | null;
    isActive: boolean;
  };
}

export function ClientForm({ client }: ClientFormProps) {
  const [error, setError] = useState<string | Record<string, string[]> | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEditing = !!client;

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = isEditing
        ? await updateClient(client.id, formData)
        : await createClient(formData);

      if (result.error) {
        const errorMessage = typeof result.error === "string"
          ? result.error
          : Object.values(result.error).flat().join(", ");
        setError(result.error);
        toast.error(errorMessage);
        return;
      }

      toast.success(isEditing ? "Client updated successfully" : "Client created successfully");
      router.push("/clients");
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit(new FormData(event.currentTarget));
      }}
      className="space-y-3"
    >
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {typeof error === "string" ? error : Object.values(error).flat().join(", ")}
        </div>
      )}
      <div className="flex items-center gap-6 text-lg">
        <span className="font-semibold text-slate-900">Contacts</span>
        <span className="text-slate-500">Configuration</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-3">
          <Button type="submit" className="bg-[#7c4a69] hover:bg-[#6d425d]" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Save" : "Create"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </Button>
          <div>
            <p className="text-[#0b7285]">Contacts</p>
            <p className="text-xl font-semibold">{isEditing ? client.name : "New"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
            <Star className="h-4 w-4 text-[#7c4a69]" />
            <span>Opportunities 0</span>
          </div>
          <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
            <Calendar className="h-4 w-4 text-[#7c4a69]" />
            <span>Meetings 0</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-md border bg-white">
          <div className="grid grid-cols-1 gap-6 border-b p-5 lg:grid-cols-[160px_1fr]">
            <div className="flex h-[160px] w-[160px] items-center justify-center rounded-md border bg-slate-50 text-slate-500">
              <UserRound className="h-20 w-20" />
            </div>
            <div className="space-y-3">
              <Input
                id="name"
                name="name"
                defaultValue={client?.name || ""}
                placeholder="Name (company or person)"
                required
                disabled={isPending}
                className="h-14 border-0 px-0 text-5xl text-slate-500 shadow-none focus-visible:ring-0"
              />
              <div className="space-y-2 text-xl">
                <div className="flex items-center gap-2 text-slate-500">
                  <Mail className="h-5 w-5 text-[#7c4a69]" />
                  <Input
                    id="collegeName"
                    name="collegeName"
                    defaultValue={client?.collegeName || ""}
                    placeholder="College Name"
                    disabled={isPending}
                    className="h-8 border-0 px-0 text-2xl shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Mail className="h-5 w-5 text-[#7c4a69]" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={client?.email || ""}
                    placeholder="Email"
                    required
                    disabled={isPending}
                    className="h-8 border-0 px-0 text-2xl shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Phone className="h-5 w-5 text-[#7c4a69]" />
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={client?.phone || ""}
                    placeholder="Phone"
                    disabled={isPending}
                    className="h-8 border-0 px-0 text-2xl shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 p-5 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-base font-semibold text-slate-700">Address</Label>
              <Input id="street" name="street" defaultValue={client?.street || ""} placeholder="Street..." disabled={isPending} />
              <Input id="address" name="address" defaultValue={client?.address || ""} placeholder="Street 2..." disabled={isPending} />
              <div className="grid grid-cols-3 gap-3">
                <Input id="city" name="city" defaultValue={client?.city || ""} placeholder="City" disabled={isPending} />
                <Input id="zip" name="zip" defaultValue={client?.zip || ""} placeholder="ZIP" disabled={isPending} />
                <Input id="state" name="state" defaultValue={client?.state || ""} placeholder="State" disabled={isPending} />
              </div>
              <Input id="country" name="country" defaultValue={client?.country || ""} placeholder="Country" disabled={isPending} />
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-[130px_1fr] items-center ">
                <Label htmlFor="tags" className="text-base font-semibold text-slate-700">Tags</Label>
                <Input id="tags" name="tags" defaultValue={client?.tags || ""} placeholder="e.g. Student, VIP, Consulting" disabled={isPending} />
              </div>
            </div>
          </div>

          <div className="border-t px-5 pt-4">
            <div className="flex text-lg">
              <div className="border-b-2 border-[#7c4a69] px-4 py-2 text-[#7c4a69]">Contacts</div>
              <div className="border-b px-4 py-2 text-slate-700">Sales &amp; Purchase</div>
              <div className="border-b px-4 py-2 text-slate-700">Notes</div>
            </div>
            <div className="py-5">
              <Textarea
                id="notes"
                name="notes"
                defaultValue={client?.notes || ""}
                placeholder="Add notes..."
                rows={5}
                disabled={isPending}
                className="max-w-xl"
              />
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-2">
              <button type="button" className="rounded-md bg-[#7c4a69] px-3 py-2 text-sm font-medium text-white">
                Send message
              </button>
              <button type="button" className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900">
                Log note
              </button>
              <button type="button" className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900">
                Activity
              </button>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <Search className="h-5 w-5" />
              <Paperclip className="h-5 w-5" />
              <div className="flex items-center gap-1">
                <User className="h-5 w-5" />
                <span>0</span>
              </div>
            </div>
          </div>
          <div className="border-t pt-4 text-sm text-slate-600">
            <p className="text-right text-slate-500">Today</p>
            <div className="mt-3 flex items-start gap-3 rounded-md border p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#c79014] font-semibold text-white">
                {(client?.name || "C").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{client?.name || "New Contact"}</p>
                <p>Creating a new record...</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditing && <input type="hidden" name="isActive" value={client.isActive.toString()} />}
    </form>
  );
}
