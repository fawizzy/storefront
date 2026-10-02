import { createProduct } from "../../actions";
import { ProductForm } from "../ProductForm";

export const metadata = { title: "Add product" };

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight">Add product</h1>
      <ProductForm action={createProduct} submitLabel="Add product" />
    </div>
  );
}
