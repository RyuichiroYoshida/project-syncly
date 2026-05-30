import "@typespec/http";
import "./models.tsp";
import "./page.tsp";
import "./guest.tsp";

using Http;

@service(#{ title: "Syncly API" })
@server("http://localhost", "Local development server")
namespace SynclyService;

@error
model ErrorResponse {
  code: string;
  message: string;
  details?: string;
}
