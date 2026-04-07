import axios from "axios";
import { getPublicApiUrl } from "@/lib/env";

export const api = axios.create({
  baseURL: getPublicApiUrl(),
  timeout: 10000,
});
