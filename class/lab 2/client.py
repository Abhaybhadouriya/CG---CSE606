import grpc
import todo_pb2
import todo_pb2_grpc

def run():
    channel = grpc.insecure_channel('localhost:50051')
    stub = todo_pb2_grpc.TodoServiceStub(channel)

    # Call GetTodoList
    response = stub.GetTodoList(todo_pb2.Empty())
    print("📋 Todo List:")
    for todo in response.todos:
        print(f"  {todo.id}. {todo.title} (completed: {todo.completed})")

    # Call UpdateTodoStatus
    update_response = stub.UpdateTodoStatus(todo_pb2.UpdateTodoRequest(id=5, completed=True))
    print("🔄 Update Response:", update_response.message)
    response = stub.GetTodoList(todo_pb2.Empty())
    print("📋 Todo List:")
    for todo in response.todos:
        print(f"  {todo.id}. {todo.title} (completed: {todo.completed})")

if __name__ == '__main__':
    run()
