# Sử dụng Node.js image
FROM node:18

# Tạo thư mục làm việc trong container
WORKDIR /app

# Copy file package.json
COPY package.json ./

# Cài đặt dependencies (ở đây chỉ node core nên nhanh)
RUN npm install

# Copy toàn bộ mã nguồn
COPY . .

# Mở port 3000 ra ngoài container
EXPOSE 3000

# Chạy lệnh start
CMD ["npm", "start"]
