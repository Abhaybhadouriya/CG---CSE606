import grpc
from concurrent import futures
import todo_pb2
import todo_pb2_grpc

# In-memory todo list
todos = [
    todo_pb2.Todo(id=1, title="Learn gRPC", completed=False),
    todo_pb2.Todo(id=2, title="Write proto file", completed=True),
    todo_pb2.Todo(id=3, title="Implement server", completed=False),
    todo_pb2.Todo(id=4, title="Implement client", completed=False),
    todo_pb2.Todo(id=5, title="Test application", completed=False),
    todo_pb2.Todo(id=6, title="Deploy application", completed=False),
    todo_pb2.Todo(id=7, title="Document code", completed=False),
    todo_pb2.Todo(id=8, title="Review code", completed=False),
    todo_pb2.Todo(id=9, title="Fix bugs", completed=False),
    todo_pb2.Todo(id=10, title="Refactor code", completed=False),
    todo_pb2.Todo(id=11, title="Optimize performance", completed=False),

]

class TodoService(todo_pb2_grpc.TodoServiceServicer):
    def GetTodoList(self, request, context):
        return todo_pb2.TodoListResponse(todos=todos)

    def UpdateTodoStatus(self, request, context):
        for todo in todos:
            if todo.id == request.id:
                todo.completed = request.completed
                return todo_pb2.UpdateTodoResponse(
                    message=f"Todo {todo.id} updated successfully!"
                )
        return todo_pb2.UpdateTodoResponse(message="Todo not found.")

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    todo_pb2_grpc.add_TodoServiceServicer_to_server(TodoService(), server)
    server.add_insecure_port('[::]:50051')
    server.start()
    print("✅ Server running on port 50051...")
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
