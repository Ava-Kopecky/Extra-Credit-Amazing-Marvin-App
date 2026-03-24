package org.example

import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.application.*
import io.ktor.server.routing.*
import io.ktor.server.response.*
import io.ktor.server.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import kotlinx.serialization.Serializable
import java.util.concurrent.atomic.AtomicInteger

@Serializable
data class Task(
    val id: Int,
    val text: String,
    val completed: Boolean = false
)

@Serializable
data class CreateTaskRequest(val text: String)

@Serializable
data class UpdateTaskRequest(val text: String? = null, val completed: Boolean? = null)

val idCounter = AtomicInteger(1)
val tasks = mutableListOf(
    Task(idCounter.getAndIncrement(), "Finish extra credit setup"),
    Task(idCounter.getAndIncrement(), "Design homepage layout"),
    Task(idCounter.getAndIncrement(), "Connect frontend to Kotlin later")
)

fun main() {
    embeddedServer(Netty, port = 8080) {
        install(CORS) {
            anyHost()
            allowHeader(HttpHeaders.ContentType)
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowMethod(HttpMethod.Put)
            allowMethod(HttpMethod.Delete)
        }
        install(ContentNegotiation) {
            json()
        }
        routing {
            get("/tasks") {
                call.respond(tasks)
            }
            post("/tasks") {
                val body = call.receive<CreateTaskRequest>()
                val newTask = Task(id = idCounter.getAndIncrement(), text = body.text)
                tasks.add(newTask)
                call.respond(HttpStatusCode.Created, newTask)
            }
            put("/tasks/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                val index = tasks.indexOfFirst { it.id == id }
                if (index == -1) {
                    call.respond(HttpStatusCode.NotFound, "Task not found")
                    return@put
                }
                val body = call.receive<UpdateTaskRequest>()
                val existing = tasks[index]
                val updated = existing.copy(
                    text = body.text ?: existing.text,
                    completed = body.completed ?: existing.completed
                )
                tasks[index] = updated
                call.respond(updated)
            }
            delete("/tasks/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                val removed = tasks.removeIf { it.id == id }
                if (removed) {
                    call.respond(HttpStatusCode.NoContent)
                } else {
                    call.respond(HttpStatusCode.NotFound, "Task not found")
                }
            }
        }
    }.start(wait = true)
}