package static

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

//go:embed all:web/dist
var webDist embed.FS

func ServeStatic(r *gin.Engine) {
	distFS, err := fs.Sub(webDist, "web/dist")
	if err != nil {
		return
	}

	fileServer := http.FS(distFS)

	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		if strings.HasPrefix(path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}

		f, err := distFS.Open(strings.TrimPrefix(path, "/"))
		if err != nil {
			c.FileFromFS("/", fileServer)
			return
		}
		f.Close()

		c.FileFromFS(path, fileServer)
	})
}
