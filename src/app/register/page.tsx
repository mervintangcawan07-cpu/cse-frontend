import { redirect } from "next/navigation";

export default async function RegisterPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}>) {
  const params = await searchParams;
  const urlParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        urlParams.append(key, item);
      }
    } else if (value !== undefined) {
      urlParams.set(key, value);
    }
  }

  const queryString = urlParams.toString();
  const destination = queryString ? `/signup?${queryString}` : "/signup";

  redirect(destination);
}