import rangeParser from 'range-parser';
import mime from 'mime-types';

export class StreamHandler {
  constructor(torrentManager) {
    this.torrentManager = torrentManager;
  }

  handleStream(req, res) {
    const { infoHash, fileIndex } = req.params;
    const fileIndexNum = parseInt(fileIndex);

    try {
      const file = this.torrentManager.getFile(infoHash, fileIndexNum);
      
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const fileSize = file.length;
      const fileName = file.name;
      
      // Set content type
      const mimeType = mime.lookup(fileName) || 'video/mp4';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      
      // Handle range requests for seeking support
      const range = req.headers.range;
      
      if (range) {
        const ranges = rangeParser(fileSize, range);
        
        if (ranges === -1) {
          // Invalid range
          res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
          return res.end();
        }
        
        if (ranges === -2 || ranges.length !== 1) {
          // Multiple ranges not supported
          return res.status(416).end();
        }
        
        const { start, end } = ranges[0];
        const chunkSize = (end - start) + 1;
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);
        
        console.log(`Streaming range ${start}-${end}/${fileSize} for ${fileName}`);
        
        // Create stream for the specific range
        const stream = file.createReadStream({ start, end });
        
        stream.on('error', (error) => {
          console.error('Stream error:', error);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });
        
        stream.pipe(res);
        
      } else {
        // Stream entire file
        res.setHeader('Content-Length', fileSize);
        
        console.log(`Streaming entire file: ${fileName} (${fileSize} bytes)`);
        
        const stream = file.createReadStream();
        
        stream.on('error', (error) => {
          console.error('Stream error:', error);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });
        
        stream.pipe(res);
      }
      
    } catch (error) {
      console.error('Stream handler error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Streaming error' });
      }
    }
  }
}