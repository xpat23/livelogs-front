package main

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

func main() {
	apiURL := strings.TrimRight(os.Getenv("API_URL"), "/")
	parsed, err := url.Parse(apiURL)
	if err != nil || parsed.Hostname() == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") ||
		parsed.Path != "" || parsed.User != nil || parsed.RawQuery != "" || parsed.ForceQuery || parsed.Fragment != "" {
		log.Fatal("API_URL must be an HTTP or HTTPS origin, for example https://api.example.com")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /config.json", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]string{"api_url": apiURL}); err != nil {
			log.Printf("write frontend configuration: %v", err)
		}
	})
	mux.Handle("GET /", http.FileServerFS(os.DirFS("/web")))
	server := &http.Server{
		Addr:              ":4000",
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       time.Minute,
	}
	log.Fatal(server.ListenAndServe())
}
